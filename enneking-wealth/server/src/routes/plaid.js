const express = require('express');
const router = express.Router();
const { PlaidApi, Configuration, PlaidEnvironments, Products, CountryCode } = require('plaid');

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

// In-memory store (replace with DynamoDB in production)
const linkedAccounts = new Map();

// Create link token for Plaid Link UI
router.post('/link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'enneking-user-1' },
      client_name: 'Enneking Wealth',
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Link token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token for access token
router.post('/exchange-token', async (req, res) => {
  try {
    const { public_token, institution } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store the access token
    linkedAccounts.set(itemId, {
      accessToken,
      institution: institution?.name || 'Unknown',
      institutionId: institution?.institution_id,
      linkedAt: new Date().toISOString(),
    });

    res.json({ success: true, itemId, institution: institution?.name });
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Get all linked accounts with balances
router.get('/accounts', async (req, res) => {
  try {
    const allAccounts = [];

    for (const [itemId, item] of linkedAccounts) {
      try {
        const response = await plaidClient.accountsGet({
          access_token: item.accessToken,
        });
        allAccounts.push({
          itemId,
          institution: item.institution,
          accounts: response.data.accounts.map(acct => ({
            id: acct.account_id,
            name: acct.name,
            officialName: acct.official_name,
            type: acct.type,
            subtype: acct.subtype,
            balances: {
              current: acct.balances.current,
              available: acct.balances.available,
              currency: acct.balances.iso_currency_code,
            },
          })),
        });
      } catch (err) {
        console.error(`Error fetching accounts for ${itemId}:`, err.message);
      }
    }

    res.json({ accounts: allAccounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get investment holdings
router.get('/holdings', async (req, res) => {
  try {
    const allHoldings = [];

    for (const [itemId, item] of linkedAccounts) {
      try {
        const response = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken,
        });

        const securities = new Map(
          response.data.securities.map(s => [s.security_id, s])
        );

        allHoldings.push({
          itemId,
          institution: item.institution,
          accounts: response.data.accounts,
          holdings: response.data.holdings.map(h => {
            const security = securities.get(h.security_id);
            return {
              accountId: h.account_id,
              securityId: h.security_id,
              ticker: security?.ticker_symbol,
              name: security?.name,
              type: security?.type,
              quantity: h.quantity,
              price: h.institution_price,
              priceDate: h.institution_price_as_of,
              value: h.institution_value,
              costBasis: h.cost_basis,
            };
          }),
        });
      } catch (err) {
        console.error(`Error fetching holdings for ${itemId}:`, err.message);
      }
    }

    res.json({ holdings: allHoldings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// Get investment transactions
router.get('/transactions', async (req, res) => {
  try {
    const allTransactions = [];
    const startDate = req.query.start || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const endDate = req.query.end || new Date().toISOString().split('T')[0];

    for (const [itemId, item] of linkedAccounts) {
      try {
        const response = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
        });

        allTransactions.push({
          itemId,
          institution: item.institution,
          transactions: response.data.investment_transactions,
        });
      } catch (err) {
        console.error(`Error fetching transactions for ${itemId}:`, err.message);
      }
    }

    res.json({ transactions: allTransactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Remove linked account
router.delete('/accounts/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const item = linkedAccounts.get(itemId);

  if (!item) {
    return res.status(404).json({ error: 'Account not found' });
  }

  try {
    await plaidClient.itemRemove({ access_token: item.accessToken });
    linkedAccounts.delete(itemId);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove account error:', error.message);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// Get list of linked institutions
router.get('/institutions', (req, res) => {
  const institutions = [];
  for (const [itemId, item] of linkedAccounts) {
    institutions.push({
      itemId,
      name: item.institution,
      linkedAt: item.linkedAt,
    });
  }
  res.json({ institutions });
});

module.exports = router;
