import { EditorialPage } from './components'
import { useI18n } from './i18n'
import { TOC_EN, ContentEn } from './content/en'
import { TOC_ZH, ContentZh } from './content/zh'

export default function App() {
  const { locale } = useI18n()

  const toc = locale === 'zh' ? TOC_ZH : TOC_EN
  const content = locale === 'zh' ? <ContentZh /> : <ContentEn />

  return (
    <EditorialPage toc={toc}>
      {content}
    </EditorialPage>
  )
}
