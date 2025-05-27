import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFile, faArrowUp } from '@fortawesome/free-solid-svg-icons';

function FileExplorer({ onFileSelect }) {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadDirectoryContents = async (path = null) => {
    try {
      setLoading(true);
      const contents = await invoke("get_directory_contents", { path });
      setFiles(contents);
      setCurrentPath(path);
    } catch (error) {
      console.error("Ошибка при загрузке списка файлов:", error);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем директорию при монтировании компонента
  useEffect(() => {
    loadDirectoryContents();
  }, []);

  // Обработчик клика по файлу или директории
  const handleItemClick = (item) => {
    if (item.is_dir) {
      // Если это директория, загружаем её содержимое
      loadDirectoryContents(item.path);
    } else {
      // Если это файл, вызываем обработчик выбора файла
      onFileSelect(item);
    }
  };

  // Переход в родительскую директорию
  const goToParentDirectory = () => {
    if (!currentPath) return;
    
    // Получаем путь родительской директории
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    loadDirectoryContents(parentPath || null);
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        {/* Заголовок убран */}
        {currentPath && (
          <button 
            onClick={goToParentDirectory} 
            className="parent-dir-button"
            title="Перейти в родительскую директорию"
          >
            <FontAwesomeIcon icon={faArrowUp} />
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <ul className="file-list">
          {files.length === 0 ? (
            <li className="empty-directory">Нет файлов</li>
          ) : (
            files.map((item, index) => (
              <li 
                key={index} 
                className={`file-item ${item.is_dir ? 'directory' : 'file'}`}
                onClick={() => handleItemClick(item)}
              >
                <span className="file-icon">
                  <FontAwesomeIcon icon={item.is_dir ? faFolder : faFile} />
                </span>
                <span className="file-name">{item.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default FileExplorer; 