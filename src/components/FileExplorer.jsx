import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFile, faPlus } from '@fortawesome/free-solid-svg-icons';

function FileExplorer({ onFileSelect, directoryPath }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
  const [newFileName, setNewFileName] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const contextMenuRef = useRef(null);
  const newFileInputRef = useRef(null);

  const loadDirectoryContents = async (path = directoryPath) => {
    try {
      setLoading(true);
      const contents = await invoke("get_directory_contents", { path });
      setFiles(contents);
    } catch (error) {
      console.error("Ошибка при загрузке списка файлов:", error);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем директорию при монтировании компонента или изменении пути
  useEffect(() => {
    if (directoryPath) {
      loadDirectoryContents(directoryPath);
    }
  }, [directoryPath]);

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setContextMenu({ show: false, x: 0, y: 0 });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Фокус на поле ввода при создании нового файла
  useEffect(() => {
    if (isCreatingFile && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [isCreatingFile]);

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

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleCreateNewFile = async () => {
    setContextMenu({ show: false, x: 0, y: 0 });
    setIsCreatingFile(true);
    setNewFileName("");
  };

  const handleNewFileNameSubmit = async (e) => {
    if (e.key === "Enter" && newFileName.trim()) {
      try {
        const fullPath = `${directoryPath}/${newFileName.trim()}`;
        await invoke("create_file", { path: fullPath });
        setIsCreatingFile(false);
        loadDirectoryContents(); // Перезагружаем список файлов
        
        // Открываем созданный файл в редакторе
        onFileSelect({
          name: newFileName.trim(),
          path: fullPath,
          is_dir: false
        });
      } catch (error) {
        console.error("Ошибка при создании файла:", error);
      }
    } else if (e.key === "Escape") {
      setIsCreatingFile(false);
    }
  };

  return (
    <div className="file-explorer" onContextMenu={handleContextMenu}>
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <ul className="file-list">
          {isCreatingFile && (
            <li className="file-item new-file">
              <span className="file-icon">
                <FontAwesomeIcon icon={faFile} />
              </span>
              <input
                ref={newFileInputRef}
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={handleNewFileNameSubmit}
                onBlur={() => setIsCreatingFile(false)}
                placeholder="Введите имя файла..."
                className="new-file-input"
              />
            </li>
          )}
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

      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
          }}
        >
          <div className="context-menu-item" onClick={handleCreateNewFile}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Создать новый файл</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileExplorer; 