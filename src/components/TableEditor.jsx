import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faArrowLeft, faArrowRight, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

const TableEditor = ({ initialData = null, onSave, onCancel }) => {
  // Инициализируем состояние с учетом initialData
  const [tableData, setTableData] = useState(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      // Проверяем, что все строки имеют одинаковую длину
      const maxCols = Math.max(...initialData.map(row => row.length));
      return initialData.map(row => {
        const newRow = [...row];
        while (newRow.length < maxCols) {
          newRow.push('');
        }
        return newRow;
      });
    }
    return [
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];
  });

  const handleCellChange = (rowIndex, colIndex, value) => {
    setTableData(prevData => {
      const newData = prevData.map(row => [...row]);
      newData[rowIndex][colIndex] = value;
      return newData;
    });
  };

  const addRow = (index) => {
    setTableData(prevData => {
      const newData = [...prevData];
      newData.splice(index + 1, 0, Array(prevData[0].length).fill(''));
      return newData;
    });
  };

  const removeRow = (index) => {
    setTableData(prevData => {
      if (prevData.length <= 1) return prevData;
      const newData = [...prevData];
      newData.splice(index, 1);
      return newData;
    });
  };

  const addColumn = (index) => {
    setTableData(prevData => {
      return prevData.map(row => {
        const newRow = [...row];
        newRow.splice(index + 1, 0, '');
        return newRow;
      });
    });
  };

  const removeColumn = (index) => {
    setTableData(prevData => {
      if (prevData[0].length <= 1) return prevData;
      return prevData.map(row => {
        const newRow = [...row];
        newRow.splice(index, 1);
        return newRow;
      });
    });
  };

  const convertToMarkdown = () => {
    if (!tableData.length) return '';
    
    // Форматируем каждую строку, добавляя | в начале и конце
    const formatRow = (row) => {
      return '| ' + row.map(cell => cell.trim()).join(' | ') + ' |';
    };

    // Создаем заголовок таблицы
    const header = formatRow(tableData[0]);
    
    // Создаем разделитель
    const separator = '| ' + tableData[0].map(() => '---').join(' | ') + ' |';
    
    // Создаем строки данных
    const rows = tableData.slice(1).map(formatRow);
    
    // Объединяем все части таблицы
    return [header, separator, ...rows].join('\n');
  };

  const handleSave = () => {
    onSave(convertToMarkdown());
  };

  const handleKeyDown = (e, rowIndex, colIndex) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = (colIndex + 1) % tableData[0].length;
      const nextRow = colIndex === tableData[0].length - 1 ? (rowIndex + 1) % tableData.length : rowIndex;
      const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  return (
    <div className="table-editor">
      <div className="table-editor-toolbar">
        <button onClick={handleSave} className="save-button">
          Сохранить
        </button>
        <button onClick={onCancel} className="cancel-button">
          Отмена
        </button>
      </div>
      <div className="table-container">
        <table>
          <tbody>
            {tableData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex}>
                    <div className="cell-container">
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                        data-row={rowIndex}
                        data-col={colIndex}
                        placeholder="Введите текст..."
                      />
                      <div className="cell-controls">
                        <button onClick={() => addRow(rowIndex)} title="Добавить строку">
                          <FontAwesomeIcon icon={faArrowDown} />
                        </button>
                        <button onClick={() => removeRow(rowIndex)} title="Удалить строку">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                        <button onClick={() => addColumn(colIndex)} title="Добавить столбец">
                          <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                        <button onClick={() => removeColumn(colIndex)} title="Удалить столбец">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableEditor; 