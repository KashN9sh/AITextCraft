import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFolderPlus, faClock, faHistory } from '@fortawesome/free-solid-svg-icons';

function WelcomeScreen({ onSelectDirectory }) {
  const [recentDirectories, setRecentDirectories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загружаем историю директорий при монтировании компонента
  useEffect(() => {
    loadDirectoryHistory();
  }, []);

  // Загрузка истории директорий
  const loadDirectoryHistory = async () => {
    try {
      setLoading(true);
      const history = await invoke("load_directory_history");
      setRecentDirectories(history || []);
    } catch (error) {
      console.error("Ошибка при загрузке истории директорий:", error);
    } finally {
      setLoading(false);
    }
  };

  // Функция выбора директории через системный диалог
  const handleSelectDirectory = async () => {
    try {
      const directory = await invoke("select_directory");
      if (directory) {
        // Добавляем новую директорию в историю
        const updatedHistory = [directory, ...recentDirectories.filter(dir => dir.path !== directory.path)].slice(0, 10);
        setRecentDirectories(updatedHistory);
        
        // Сохраняем историю
        await invoke("save_directory_history", { directories: updatedHistory });
        
        // Передаем директорию в родительский компонент
        onSelectDirectory(directory);
      }
    } catch (error) {
      console.error("Ошибка при выборе директории:", error);
    }
  };

  // Обработчик клика по директории из истории
  const handleDirectoryClick = async (directory) => {
    // Обновляем историю, чтобы выбранная директория была первой
    const updatedHistory = [directory, ...recentDirectories.filter(dir => dir.path !== directory.path)].slice(0, 10);
    setRecentDirectories(updatedHistory);
    
    // Сохраняем историю
    await invoke("save_directory_history", { directories: updatedHistory });
    
    // Передаем директорию в родительский компонент
    onSelectDirectory(directory);
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-header">
        <h1>FancyTexty</h1>
        <p>Элегантный Markdown редактор</p>
      </div>

      <div className="welcome-actions">
        <button
          className="select-dir-button"
          onClick={handleSelectDirectory}
        >
          <FontAwesomeIcon icon={faFolderPlus} />
          Выбрать директорию
        </button>
      </div>

      <div className="recent-directories">
        <h2>
          <FontAwesomeIcon icon={faHistory} />
          Недавние директории
        </h2>
        {loading ? (
          <div className="loading-history">
            Загрузка истории...
          </div>
        ) : (
          <ul className="directory-list">
            {recentDirectories.map((dir, index) => (
              <li
                key={dir.path}
                className="directory-item"
                onClick={() => onSelectDirectory(dir)}
              >
                <FontAwesomeIcon icon={faFolderOpen} className="dir-icon" />
                <div className="dir-info">
                  <div className="dir-name">{dir.name}</div>
                  <div className="dir-path">{dir.path}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default WelcomeScreen; 