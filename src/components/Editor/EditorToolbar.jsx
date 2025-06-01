import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLink, 
  faSave, 
  faFolderOpen, 
  faEye, 
  faEdit, 
  faHome, 
  faPlus, 
  faTimes 
} from '@fortawesome/free-solid-svg-icons';
import { formatText } from '../../utils/markdownUtils';

const EditorToolbar = ({ 
  onSave, 
  onToggleExplorer, 
  onTogglePreview, 
  onHomeClick,
  onInsertText,
  onTableButtonClick 
}) => {
  const insertAtCursor = (prefix, suffix = '') => {
    if (onInsertText) {
      onInsertText(prefix, suffix);
    }
  };

  const quickInsertButtons = [
    { onClick: () => insertAtCursor("**", "**"), title: "Жирный (Ctrl/Cmd + B)", content: <b>B</b> },
    { onClick: () => insertAtCursor("*", "*"), title: "Курсив (Ctrl/Cmd + I)", content: <i>I</i> },
    { onClick: () => insertAtCursor("# "), title: "Заголовок (Ctrl/Cmd + Shift + H)", content: "H1" },
    { onClick: () => insertAtCursor("- "), title: "Список (Ctrl/Cmd + Shift + L)", content: "•" },
    { onClick: () => insertAtCursor("[текст](url)"), title: "Ссылка (Ctrl/Cmd + K)", content: <FontAwesomeIcon icon={faLink} /> },
    { onClick: () => insertAtCursor("`", "`"), title: "Код (Ctrl/Cmd + Shift + C)", content: <>&lt;/&gt;</> },
    { onClick: () => insertAtCursor("> "), title: "Цитата (Ctrl/Cmd + Shift + Q)", content: "❝" },
    { onClick: onTableButtonClick, title: "Таблица (Ctrl/Cmd + Shift + T)", content: "⊞" },
    { onClick: () => insertAtCursor("- [ ] "), title: "Чекбокс (Ctrl/Cmd + Shift + B)", content: "☐" }
  ];

  return (
    <div className="quick-insert-bar">
      <div className="quick-insert-left">
        <button
          onClick={onHomeClick}
          className="toolbar-button"
          title="На главный экран"
        >
          <FontAwesomeIcon icon={faHome} />
        </button>
        <button
          onClick={onToggleExplorer}
          className="toolbar-button"
          title="Показать/скрыть проводник"
        >
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
        <button
          onClick={onTogglePreview}
          className="toolbar-button"
          title="Предпросмотр"
        >
          <FontAwesomeIcon icon={faEye} />
        </button>
        <button
          onClick={onSave}
          className="toolbar-button"
          title="Сохранить (Ctrl/Cmd + S)"
        >
          <FontAwesomeIcon icon={faSave} />
        </button>
      </div>
      <div className="quick-insert-center">
        {quickInsertButtons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            title={button.title}
            className="toolbar-button"
          >
            {button.content}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EditorToolbar; 