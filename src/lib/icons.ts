import type { LucideIcon } from 'lucide-react'
import Bot from 'lucide-react/icons/bot'
import ChevronDown from 'lucide-react/icons/chevron-down'
import ChevronLeft from 'lucide-react/icons/chevron-left'
import CircleCheck from 'lucide-react/icons/circle-check'
import CircleExclamationPoint from 'lucide-react/icons/circle-exclamation-point'
import CircleQuestionMark from 'lucide-react/icons/circle-question-mark'
import CircleSlash from 'lucide-react/icons/circle-slash'
import CircleX from 'lucide-react/icons/circle-x'
import Coffee from 'lucide-react/icons/coffee'
import EllipsisVertical from 'lucide-react/icons/ellipsis-vertical'
import Globe from 'lucide-react/icons/globe'
import Keyboard from 'lucide-react/icons/keyboard'
import Languages from 'lucide-react/icons/languages'
import LoaderCircle from 'lucide-react/icons/loader-circle'
import Minimize2 from 'lucide-react/icons/minimize-2'
import Monitor from 'lucide-react/icons/monitor'
import Moon from 'lucide-react/icons/moon'
import Paperclip from 'lucide-react/icons/paperclip'
import PencilSparkles from 'lucide-react/icons/pencil-sparkles'
import ScrollText from 'lucide-react/icons/scroll-text'
import Search from 'lucide-react/icons/search'
import Sun from 'lucide-react/icons/sun'
import type { ICON_SEMANTICS } from '@i360/icons'

// Every fixed icon the app draws (icons named by data, such as the sciences', are iconsLoader.ts).
// Its meanings and their icons are decided once, in hub/src/icons.js (shared with the hub
// pages); this file only maps each meaning the app uses to its lucide-react component
// (icons.test.ts checks each one is the named icon). Each is imported from its own file, by
// Lucide's current name — the same name as in hub/src/icons.js. Components import icons from
// here, never from lucide-react (ESLint enforces it).

type Semantics = typeof ICON_SEMANTICS

export const ICON = {
  menu: EllipsisVertical,
  search: Search,
  searchAuto: PencilSparkles,
  searchOnly: Minimize2,
  translating: Languages,
  exegesis: ScrollText,
  assistant: Bot,
  keyboard: Keyboard,
  loading: LoaderCircle,
  checked: CircleCheck,
  invalid: CircleExclamationPoint,
  notFound: CircleQuestionMark,
  openFailed: CircleX,
  badIcon: CircleSlash,
  collapsed: ChevronLeft,
  expanded: ChevronDown,
  web: Globe,
  attachment: Paperclip,
} satisfies Partial<Record<Exclude<keyof Semantics, 'theme'>, LucideIcon>>

export const THEME_ICON = {
  system: Monitor,
  light: Sun,
  sepia: Coffee,
  dark: Moon,
} satisfies Record<keyof Semantics['theme'], LucideIcon>
