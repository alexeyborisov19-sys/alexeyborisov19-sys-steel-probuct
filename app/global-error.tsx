"use client";

import React from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f12',
          color: '#e6eef6',
          padding: '24px'
        }}>
          <div style={{maxWidth: 720, textAlign: 'center'}}>
            <h1 style={{margin: 0, fontSize: 28}}>Обновляем страницу</h1>
            <p style={{color: '#c7d6df'}}>Браузер сохранил предыдущую версию сайта и показывaет её из-за ошибки. Попробуйте обновить сайт — это загрузит новую версию и обычно решает проблему.</p>
            <div style={{marginTop: 18}}>
              <button
                onClick={() => reset()}
                style={{
                  background: '#ff7a18',
                  border: 'none',
                  color: '#0b0f12',
                  padding: '10px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >Обновить сайт</button>
            </div>
            <details style={{marginTop: 12, color: '#98aab6', textAlign: 'left'}}>
              <summary>Техническая информация (для разработчиков)</summary>
              <pre style={{whiteSpace: 'pre-wrap'}}>{String(error?.message || '')}</pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}
