import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFolderPlus, faClock, faHistory } from '@fortawesome/free-solid-svg-icons';
import { useSpring, animated } from 'react-spring';

function WelcomeScreen({ onSelectDirectory }) {
  const [recentDirectories, setRecentDirectories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Анимация панели (выпадение сверху)
  const containerAnimation = useSpring({
    from: { 
      opacity: 0,
      transform: 'translateY(-100%)'
    },
    to: { 
      opacity: 1,
      transform: 'translateY(0%)'
    },
    config: { 
      tension: 300,
      friction: 20
    }
  });

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
    <animated.div className="welcome-screen" style={containerAnimation}>
      <animated.div className="welcome-header" style={containerAnimation}>
        <h1>FancyTexty</h1>
        <p>Элегантный Markdown редактор</p>
      </animated.div>

      <animated.div className="welcome-actions" style={containerAnimation}>
        <button
          className="select-dir-button"
          onClick={handleSelectDirectory}
        >
          <FontAwesomeIcon icon={faFolderPlus} />
          Выбрать директорию
        </button>
      </animated.div>

      <div className="recent-directories">
        <animated.h2 style={containerAnimation}>
          <FontAwesomeIcon icon={faHistory} />
          Недавние директории
        </animated.h2>
        {loading ? (
          <animated.div className="loading-history" style={containerAnimation}>
            Загрузка истории...
          </animated.div>
        ) : (
          <ul className="directory-list">
            {recentDirectories.map((directory) => (
              <li
                key={directory.path}
                className="directory-item"
                onClick={() => onSelectDirectory(directory)}
              >
                <FontAwesomeIcon icon={faFolderOpen} className="dir-icon" />
                <div className="dir-info">
                  <div className="dir-name">{directory.name}</div>
                  <div className="dir-path">{directory.path}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </animated.div>
  );
}

export default WelcomeScreen; 