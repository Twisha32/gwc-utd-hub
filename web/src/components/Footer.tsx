import { club } from '@/lib/club';

export function Footer() {
  const links = [
    club.discord && { href: club.discord, label: 'Discord' },
    club.instagram && { href: club.instagram, label: 'Instagram' },
    club.github && { href: club.github, label: 'GitHub' },
    club.contactEmail && { href: `mailto:${club.contactEmail}`, label: club.contactEmail },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <span>{club.name}</span>
        {links.length > 0 && (
          <div className="footer-links">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
