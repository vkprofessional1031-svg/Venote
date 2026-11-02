import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'wordmark' | 'icon';
  className?: string;
};

export default function BrandLogo({ variant = 'wordmark', className = 'h-10' }: BrandLogoProps) {
  const iconOnly = variant === 'icon';
  return (
    <span className={`venote-brand inline-flex max-w-full shrink-0 items-center gap-3 ${className}`}>
      <Image
        src="/brand/venote-icon.png"
        alt={iconOnly ? 'Venote' : ''}
        width={1146}
        height={1155}
        unoptimized
        className="block h-full w-auto shrink-0 object-contain"
      />
      {!iconOnly && (
        <span className="venote-brand-wordmark font-serif italic font-bold text-[32px] tracking-tight leading-none text-primary-text">
          Venote
        </span>
      )}
    </span>
  );
}
