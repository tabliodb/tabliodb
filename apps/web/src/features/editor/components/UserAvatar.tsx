import { cn } from '@tabliodb/ui';

export type AvatarIdentity = {
  avatarUrl?: string | null;
  cursorColor?: string | null;
  email: string;
  name: string;
};

export function UserAvatar({ className, user }: { className?: string; user: AvatarIdentity }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] font-extrabold text-[rgb(var(--tabliodb-primary-text))]',
        className,
      )}
      style={user.cursorColor ? { backgroundColor: user.cursorColor } : undefined}
    >
      {user.avatarUrl ? (
        <img alt="" className="size-full object-cover" src={user.avatarUrl} />
      ) : (
        getMemberInitials(user)
      )}
    </div>
  );
}

function getMemberInitials(member: Pick<AvatarIdentity, 'email' | 'name'>): string {
  const source = member.name.trim() || member.email;

  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
