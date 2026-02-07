import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'enneking-wealth-todos';

function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : getDefaultTodos();
  } catch {
    return getDefaultTodos();
  }
}

function getDefaultTodos() {
  return [
    { id: 1, text: 'Link Fidelity account', done: false, category: 'Setup' },
    { id: 2, text: 'Link Merrill Lynch account', done: false, category: 'Setup' },
    { id: 3, text: 'Set net worth goal', done: false, category: 'Setup' },
    { id: 4, text: 'Add home equity value', done: false, category: 'Setup' },
    { id: 5, text: 'Review SPAXX cash allocation', done: false, category: 'Investing' },
    { id: 6, text: 'Update RSU award details', done: false, category: 'Compensation' },
    { id: 7, text: 'Review pension projections', done: false, category: 'Retirement' },
  ];
}

export default function TodoList() {
  const [todos, setTodos] = useState(loadTodos);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const addTodo = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, {
      id: Date.now(),
      text: newTodo.trim(),
      done: false,
      category: 'General',
    }]);
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const doneCount = todos.filter(t => t.done).length;

  return (
    <div className="page-container">
      <h1>To-Do</h1>

      <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
        {doneCount} of {todos.length} completed
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'active', 'done'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: filter === f ? 'white' : 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Add todo */}
      <form onSubmit={addTodo} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            placeholder="Add a task..."
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }}>
            Add
          </button>
        </div>
      </form>

      {/* Todo list */}
      {filtered.map(todo => (
        <div
          key={todo.id}
          className="holding-card"
          style={{ opacity: todo.done ? 0.5 : 1 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <button
              onClick={() => toggleTodo(todo.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `2px solid ${todo.done ? 'var(--accent-green)' : 'var(--border)'}`,
                background: todo.done ? 'var(--accent-green)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {todo.done ? '\u2713' : ''}
            </button>
            <div>
              <div style={{
                fontSize: 14,
                textDecoration: todo.done ? 'line-through' : 'none',
              }}>
                {todo.text}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {todo.category}
              </div>
            </div>
          </div>
          <button
            onClick={() => deleteTodo(todo.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 16,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            \u00D7
          </button>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">{'\u2713'}</div>
          <p>{filter === 'done' ? 'No completed tasks yet' : 'All caught up!'}</p>
        </div>
      )}
    </div>
  );
}
