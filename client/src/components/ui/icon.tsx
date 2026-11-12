import type { LucideIcon, LucideProps } from "lucide-react-native";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  Download,
  Droplet,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  House,
  IndianRupee,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  User,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react-native";

/**
 * App-wide icon names. Keeping a small registry (instead of importing the
 * whole lucide icon set) keeps the bundle lean and gives us a single place to
 * swap an icon.
 */
const ICONS = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  award: Award,
  bell: Bell,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  camera: Camera,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-right": ChevronRight,
  clock: Clock,
  "credit-card": CreditCard,
  download: Download,
  droplet: Droplet,
  eye: Eye,
  "eye-off": EyeOff,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  home: House,
  "indian-rupee": IndianRupee,
  "key-round": KeyRound,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  megaphone: Megaphone,
  pencil: Pencil,
  plus: Plus,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  user: User,
  "user-round": UserRound,
  users: Users,
  wallet: Wallet,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconProps = LucideProps & {
  name: IconName;
};

export function Icon({
  name,
  size = 24,
  color = "#2D2926",
  strokeWidth = 2,
  ...props
}: IconProps) {
  const Glyph = ICONS[name];

  return (
    <Glyph
      aria-hidden
      color={color}
      size={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
