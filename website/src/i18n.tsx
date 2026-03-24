import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Locale = 'en' | 'zh'

const LOCALES: Locale[] = ['en', 'zh']
const DEFAULT_LOCALE: Locale = 'en'

function getInitialLocale(): Locale {
  // Check URL hash first: #zh or #en
  const hash = window.location.hash.replace('#', '')
  if (LOCALES.includes(hash as Locale)) return hash as Locale

  // Check localStorage
  const stored = localStorage.getItem('locale')
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale

  // Check browser language
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh'

  return DEFAULT_LOCALE
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const translations: Record<Locale, Record<string, string>> = {
  en: {
    switchLabel: '中文',
  },
  zh: {
    switchLabel: 'EN',
  },
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
    window.location.hash = newLocale === DEFAULT_LOCALE ? '' : newLocale
    document.documentElement.lang = newLocale
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    // Sync hash on mount
    if (locale !== DEFAULT_LOCALE) {
      window.location.hash = locale
    }
  }, [locale])

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (LOCALES.includes(hash as Locale)) {
        setLocaleState(hash as Locale)
        localStorage.setItem('locale', hash)
      } else if (hash === '') {
        setLocaleState(DEFAULT_LOCALE)
        localStorage.setItem('locale', DEFAULT_LOCALE)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const t = useCallback(
    (key: string) => translations[locale]?.[key] ?? key,
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
