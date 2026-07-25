import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

export default function BrandLogo({ size = 36, className = '' }: Props) {
  return (
    <img
      src="/icon-192.svg"
      width={size}
      height={size}
      alt="CoachPro"
      className={`shrink-0 rounded-xl shadow-lg shadow-blue-500/20 ${className}`}
      draggable={false}
    />
  );
}
