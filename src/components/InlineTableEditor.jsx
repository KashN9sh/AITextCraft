import React, { useState } from 'react';

// Преобразует markdown-таблицу в двумерный массив
function parseMarkdownTable(markdown) {
  const lines = markdown.trim().split('\n');
  if (lines.length < 2) return [];
  // Убираем разделитель
  const dataLines = lines.filter((_, i) => i !== 1);
  return dataLines.map(line =>
    line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
  );
}

// Преобразует двумерный массив обратно в markdown-таблицу
function toMarkdownTable(data) {
  if (!data.length) return '';
  const formatRow = row => '| ' + row.map(cell => cell.trim()).join(' | ') + ' |';
  const header = formatRow(data[0]);
  const separator = '| ' + data[0].map(() => '---').join(' | ') + ' |';
  const rows = data.slice(1).map(formatRow);
  return [header, separator, ...rows].join('\n');
}

const InlineTableEditor = ({ markdown, onChange }) => {
  const [table, setTable] = useState(() => parseMarkdownTable(markdown));
  const [editing, setEditing] = useState({ row: null, col: null });
  const [editValue, setEditValue] = useState('');

  // Начать редактирование ячейки
  const handleCellClick = (rowIdx, colIdx) => {
    setEditing({ row: rowIdx, col: colIdx });
    setEditValue(table[rowIdx][colIdx]);
  };

  // Сохранить значение ячейки
  const handleCellBlur = () => {
    if (editing.row === null || editing.col === null) return;
    const newTable = table.map(row => [...row]);
    newTable[editing.row][editing.col] = editValue;
    setTable(newTable);
    setEditing({ row: null, col: null });
    setEditValue('');
    onChange(toMarkdownTable(newTable));
  };

  // Обработка Enter
  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    }
  };

  return (
    <div className="inline-table-editor">
      <table className="markdown-body-table" style={{ width: '100%' }}>
        <tbody>
          {table.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, colIdx) => {
                const isHeader = rowIdx === 0;
                return isHeader ? (
                  <th key={colIdx} style={{ background: 'var(--primary-light)', fontWeight: 600, textAlign: 'center', padding: '0.6em 0.5em' }}>
                    {editing.row === rowIdx && editing.col === colIdx ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        style={{ width: '100%', minWidth: 0, font: 'inherit', padding: 0, border: '1px solid var(--primary-color)', background: 'var(--primary-light)', fontWeight: 600, textAlign: 'center' }}
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                        style={{ cursor: 'pointer', minHeight: 24 }}
                      >
                        {cell || <span style={{ opacity: 0.3 }}>[пусто]</span>}
                      </div>
                    )}
                  </th>
                ) : (
                  <td key={colIdx}>
                    {editing.row === rowIdx && editing.col === colIdx ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        style={{ width: '100%', minWidth: 0, font: 'inherit', padding: 0, border: '1px solid var(--primary-color)' }}
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                        style={{ cursor: 'pointer', minHeight: 24 }}
                      >
                        {cell || <span style={{ opacity: 0.3 }}>[пусто]</span>}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InlineTableEditor; 