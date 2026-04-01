import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';

type ThemeMode = 'dark' | 'light';

interface ThemeCtx {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ mode: 'dark', toggle: () => {} });

export const useTheme = () => useContext(ThemeContext);

function getInitial(): ThemeMode {
  const stored = localStorage.getItem('pdm_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('pdm_theme', mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

  const themeConfig = useMemo(() => {
    if (mode === 'dark') {
      return {
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: '#1a2236',
          colorBgElevated: '#1a2236',
          colorBorder: '#2a3654',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          borderRadius: 8,
          fontSize: 14,
        },
      };
    }
    return {
      algorithm: antTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#2563eb',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#e2e8f0',
        colorText: '#1e293b',
        colorTextSecondary: '#475569',
        borderRadius: 8,
        fontSize: 14,
      },
    };
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      <ConfigProvider locale={zhCN} theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
