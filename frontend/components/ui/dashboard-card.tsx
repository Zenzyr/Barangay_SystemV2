import React from 'react';

interface DashboardCardProps {
  title: string;
  icon?: React.ElementType;
  className?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function DashboardCard({ title, icon: Icon, className, children, headerAction }: DashboardCardProps) {
  return (
    <section className={`glass-card overflow-hidden ${className || ''}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="size-4 text-sky-600" />}
          {title}
        </h2>
        {headerAction}
      </div>
      {children}
    </section>
  );
}
