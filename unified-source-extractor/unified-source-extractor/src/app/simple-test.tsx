"use client";

export default function SimpleTest() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      padding: '40px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        ✅ Unified Source Extractor - Test Page
      </h1>
      
      <div style={{
        backgroundColor: '#f0f9ff',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #0ea5e9'
      }}>
        <h2>🎯 Status Check</h2>
        <ul>
          <li>✅ Next.js is running</li>
          <li>✅ React is working</li>
          <li>✅ TypeScript is compiling</li>
          <li>✅ Styling is applied</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px' }}>
        <a 
          href="/"
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            display: 'inline-block'
          }}
        >
          🏠 Go to Main App
        </a>
      </div>
    </div>
  );
}