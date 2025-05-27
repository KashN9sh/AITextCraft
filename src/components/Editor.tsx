import { Editor as MonacoEditor } from '@monaco-editor/react';
import styled from '@emotion/styled';

const EditorContainer = styled.div`
  height: 100vh;
  width: 100%;
`;

interface EditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange }) => {
  return (
    <EditorContainer>
      <MonacoEditor
        height="100%"
        defaultLanguage="markdown"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          automaticLayout: true,
        }}
      />
    </EditorContainer>
  );
};