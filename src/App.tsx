import { useState } from 'react'
import styled from '@emotion/styled'
import { Editor } from './components/Editor'
import { LocalAIAssistant } from './components/LocalAIAssistant'
import './App.css'

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
`

const Header = styled.header`
  padding: 16px;
  background: #252526;
  color: white;
  font-size: 24px;
  font-weight: bold;
`

function App() {
  const [content, setContent] = useState('')

  const handleAISuggestion = (suggestion: string) => {
    setContent(prev => prev + '\n\n' + suggestion)
  }

  return (
    <AppContainer>
      <Header>AITextCraft (Локальный)</Header>
      <Editor value={content} onChange={(value) => setContent(value || '')} />
      <LocalAIAssistant onSuggestion={handleAISuggestion} />
    </AppContainer>
  )
}

export default App
