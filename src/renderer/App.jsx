import React from 'react';
import RepoList from './components/RepoList.jsx';

export default function App() {
  return (
    <main
      style={{
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        padding: '2rem',
      }}
    >
      <h1>Local Dev Launcher</h1>
      <p>SelfPoint local environment launcher.</p>
      <RepoList />
    </main>
  );
}
