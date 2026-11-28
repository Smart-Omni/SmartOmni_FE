// Layout pieces shared by the marketplace return hubs, so Shopee and TikTok stay visually identical.
import demo from './ReturnHubDemo.module.css'

export function KpiGrid({ cards }) {
  return (
    <div className={demo.kpiGrid}>
      {cards.map(({ label, value, hint, icon: Icon, color, tone, active, onClick }) => (
        <button
          key={label}
          type="button"
          className={`${demo.kpiCard} ${demo[tone]} ${active ? demo.kpiCardActive : ''}`}
          onClick={onClick}
        >
          <span className={demo.kpiLabel}>{label} <Icon size={14} color={color} /></span>
          <span className={demo.kpiValue}>{value}</span>
          <span className={demo.kpiHint}>{hint}</span>
        </button>
      ))}
    </div>
  )
}

export function StageTabs({ tabs, stage, counts, onSelect }) {
  return (
    <div className={demo.stageTabs} role="tablist" aria-label="Return stages">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={stage === tab.id}
          className={`${demo.stageTab} ${stage === tab.id ? demo.stageTabActive : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          <span>{tab.label}</span>
          <span className={demo.stageCount}>{counts[tab.id] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
