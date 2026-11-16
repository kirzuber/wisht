import companion from './assets/jinn-companion.png';

type Props = { size?: 'tiny' | 'small' | 'medium' | 'large'; className?: string };

/** The same companion follows a wish from its first question into saved work. */
export default function JinnAvatar({ size = 'small', className = '' }: Props) {
  return <span className={`jinn-avatar jinn-avatar-${size} ${className}`} aria-hidden="true">
    <img src={companion} alt="" />
  </span>;
}
