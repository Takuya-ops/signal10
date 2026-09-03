'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Digest, NewsCategory, Story } from '@/lib/types';

const CATEGORY_LABELS: Array<'すべて' | NewsCategory> = [
  'すべて',
  'モデル',
  'プロダクト',
  '開発者向け',
  'ビジネス',
  '政策・社会',
  '研究',
  '安全性',
];

const CATEGORY_SHORT: Record<NewsCategory, string> = {
  モデル: 'MODEL',
  プロダクト: 'PRODUCT',
  ビジネス: 'BUSINESS',
  '政策・社会': 'POLICY',
  研究: 'RESEARCH',
  '開発者向け': 'DEVELOPER',
  安全性: 'SAFETY',
};

const REMOTE_DIGEST_URL = process.env.NEXT_PUBLIC_DIGEST_URL;

function formatEdition(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function sourceMark(source: string) {
  return source
    .split(/[\s・]/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function useDialogAccessibility(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusDialog = window.requestAnimationFrame(() => {
      (dialog.querySelector<HTMLElement>(focusableSelector) || dialog).focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.classList.add('dialog-open');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.body.classList.remove('dialog-open');
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return dialogRef;
}

function StoryButton({
  story,
  variant,
  onOpen,
}: {
  story: Story;
  variant: 'feature' | 'compact' | 'row';
  onOpen: (story: Story) => void;
}) {
  return (
    <article
      className={`news-card news-card--${variant} category-${story.category.replace('・', '-')}`}
    >
      <div className="news-card__topline">
        <span className="story-rank">{String(story.rank).padStart(2, '0')}</span>
        <span className="category-code">{CATEGORY_SHORT[story.category]}</span>
        <span className={`impact-badge impact-${story.impactLabel}`}>IMPACT {story.impactLabel}</span>
      </div>
      <div className="news-card__content">
        <div className="source-line">
          <span className="source-avatar" aria-hidden="true">{sourceMark(story.source)}</span>
          <span>{story.source}</span>
          <span className="source-separator">/</span>
          <time dateTime={story.publishedAt}>{formatPublishedDate(story.publishedAt)}</time>
        </div>
        <h2>{story.title}</h2>
        <p>{story.summary}</p>
      </div>
      <div className="news-card__footer">
        <span>{story.verification}</span>
        <span className="arrow-link">内容を読む <span aria-hidden="true">↗</span></span>
      </div>
      <button
        aria-label={`第${story.rank}位「${story.title}」の内容を読む`}
        className="news-card__open"
        onClick={() => onOpen(story)}
        type="button"
      />
    </article>
  );
}

function StoryDetail({ story, onClose }: { story: Story; onClose: () => void }) {
  const dialogRef = useDialogAccessibility(onClose);

  return (
    <div className="detail-overlay" role="presentation" onMouseDown={onClose}>
      <article
        aria-labelledby="detail-title"
        aria-modal="true"
        className="detail-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="detail-panel__header">
          <span className="story-rank story-rank--large">{String(story.rank).padStart(2, '0')}</span>
          <button aria-label="詳細を閉じる" className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <div className="detail-labels">
          <span>{story.category}</span>
          <span>{story.verification}</span>
          <span>重要度 {story.impactScore}/100</span>
        </div>
        <h2 id="detail-title">{story.title}</h2>
        <p className="detail-original">{story.originalTitle}</p>
        <p className="detail-summary">{story.summary}</p>

        <section className="detail-section">
          <p className="section-kicker">WHAT HAPPENED</p>
          <h3>ニュースの内容</h3>
          <ul>
            {story.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>

        <section className="why-box">
          <p className="section-kicker">WHY IT MATTERS</p>
          <h3>なぜ重要か</h3>
          <p>{story.whyItMatters}</p>
        </section>

        {story.relatedSources.length > 0 && (
          <section className="detail-section related-section">
            <p className="section-kicker">CROSS CHECK</p>
            <h3>関連ソース</h3>
            <div className="related-links">
              {story.relatedSources.map((source) => (
                <a href={source.url} key={source.url} rel="noreferrer" target="_blank">{source.name} ↗</a>
              ))}
            </div>
          </section>
        )}

        <a className="primary-link" href={story.url} rel="noreferrer" target="_blank">
          {story.source}で原文を読む <span aria-hidden="true">↗</span>
        </a>
        <p className="detail-published">公開日: {formatPublishedDate(story.publishedAt)}（日本時間）</p>
      </article>
    </div>
  );
}

function NotificationPanel({
  digest,
  onClose,
}: {
  digest: Digest;
  onClose: () => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const dialogRef = useDialogAccessibility(onClose);

  async function enableBrowserNotifications() {
    if (typeof Notification === 'undefined') return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === 'granted') {
      try {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
          await registration.showNotification('SIGNAL 10 の通知をオンにしました', {
            body: '新しい朝刊を受信したとき、重要ニュースをお知らせします。',
            icon: '/icon-192.png',
          });
        } else {
          new Notification('SIGNAL 10 の通知をオンにしました');
        }
        localStorage.setItem('signal10-browser-notifications', 'enabled');
      } catch {
        localStorage.removeItem('signal10-browser-notifications');
      }
    }
  }

  return (
    <div className="detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        aria-labelledby="notification-title"
        aria-modal="true"
        className="notification-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="detail-panel__header">
          <p className="panel-number">06:30</p>
          <button aria-label="通知設定を閉じる" className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <p className="section-kicker">DELIVERY SETTINGS</p>
        <h2 id="notification-title">毎朝、見逃さない。</h2>
        <p className="panel-intro">朝6:30（日本時間）にニュースを更新。通知先は用途に合わせて選べます。</p>

        <div className="delivery-list">
          <div className="delivery-item">
            <div>
              <span className="delivery-status">この端末</span>
              <h3>ブラウザ通知</h3>
              <p>このページを開いた朝に、新しい号を通知します。</p>
            </div>
            <button
              className="small-button"
              disabled={permission === 'denied' || permission === 'unsupported'}
              onClick={enableBrowserNotifications}
              type="button"
            >
              {permission === 'granted' ? '設定済み' : permission === 'denied' ? '許可が必要' : 'オンにする'}
            </button>
          </div>
          <div className="delivery-item">
            <div>
              <span className="delivery-status delivery-status--active">標準</span>
              <h3>GitHub通知</h3>
              <p>毎朝のダイジェストをIssueとして配信。Actionsから自動実行されます。</p>
            </div>
            {digest.repositoryUrl ? (
              <a className="small-button small-button--ghost" href={`${digest.repositoryUrl}/issues`} rel="noreferrer" target="_blank">開く ↗</a>
            ) : <span className="small-button small-button--ghost">準備済み</span>}
          </div>
          <div className="delivery-item">
            <div>
              <span className="delivery-status">任意</span>
              <h3>Slack / Discord</h3>
              <p>WebhookをGitHub Secretsに登録すると、同じ朝刊をチャンネルへ届けます。</p>
            </div>
            {digest.repositoryUrl ? (
              <a className="small-button small-button--ghost" href={`${digest.repositoryUrl}#通知先を追加する`} rel="noreferrer" target="_blank">設定 ↗</a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function Dashboard({ initialDigest }: { initialDigest: Digest }) {
  const [digest, setDigest] = useState(initialDigest);
  const [category, setCategory] = useState<'すべて' | NewsCategory>('すべて');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteState, setRemoteState] = useState<'idle' | 'fresh' | 'fallback'>('idle');

  useEffect(() => {
    let disposed = false;
    let refreshInFlight = false;
    const controllers = new Set<AbortController>();
    const inferredRemoteUrl = initialDigest.repositoryUrl
      ? `${initialDigest.repositoryUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/main/public/data/latest.json`
      : null;
    const url = REMOTE_DIGEST_URL || inferredRemoteUrl || '/data/latest.json';

    async function refreshDigest() {
      if (refreshInFlight) return;
      refreshInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Digest returned ${response.status}`);
        const nextDigest = await response.json() as Digest;
        if (!Array.isArray(nextDigest.stories) || nextDigest.stories.length !== 10 || disposed) return;
        setDigest((current) => {
          const nextEdition = Date.parse(nextDigest.edition);
          const currentEdition = Date.parse(current.edition);
          const nextGenerated = Date.parse(nextDigest.generatedAt);
          const currentGenerated = Date.parse(current.generatedAt);
          return nextEdition > currentEdition || (nextEdition === currentEdition && nextGenerated > currentGenerated)
            ? nextDigest
            : current;
        });
        setRemoteState('fresh');
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setRemoteState('fallback');
      } finally {
        controllers.delete(controller);
        refreshInFlight = false;
      }
    }

    void refreshDigest();
    const refreshInterval = window.setInterval(() => void refreshDigest(), 5 * 60 * 1000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshDigest();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => {
      disposed = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      controllers.forEach((controller) => controller.abort());
    };
  }, [initialDigest.repositoryUrl]);

  useEffect(() => {
    if (remoteState === 'idle') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (localStorage.getItem('signal10-browser-notifications') !== 'enabled') return;
    const todayInJapan = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    if (remoteState === 'fallback' && digest.edition.slice(0, 10) !== todayInJapan) return;
    const seenEdition = localStorage.getItem('signal10-last-notified-edition');
    if (seenEdition === digest.edition) return;
    const showEditionNotification = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready;
        if (!registration) return;
        await registration.showNotification(`SIGNAL 10 — ${formatEdition(digest.edition)}`, {
          body: digest.stories[0]?.title || '今日の生成AIニュース10本を公開しました。',
          icon: '/icon-192.png',
          data: { url: '/' },
        });
        localStorage.setItem('signal10-last-notified-edition', digest.edition);
      } catch {
        // Keep the edition unmarked so a later refresh can retry delivery.
      }
    };
    void showEditionNotification();
  }, [digest, remoteState]);

  const visibleStories = useMemo(
    () => category === 'すべて' ? digest.stories : digest.stories.filter((story) => story.category === category),
    [category, digest.stories],
  );
  const leadStories = category === 'すべて' ? digest.stories.slice(0, 3) : visibleStories.slice(0, 3);
  const remainingStories = category === 'すべて' ? digest.stories.slice(3) : visibleStories.slice(3);
  const closeStory = useCallback(() => setSelectedStory(null), []);
  const closeNotifications = useCallback(() => setNotificationOpen(false), []);

  function openStory(story: Story) {
    setNotificationOpen(false);
    setSelectedStory(story);
    const read = JSON.parse(localStorage.getItem('signal10-read') || '[]') as string[];
    localStorage.setItem('signal10-read', JSON.stringify([...new Set([...read, story.id])].slice(-100)));
  }

  function openNotifications() {
    setSelectedStory(null);
    setNotificationOpen(true);
  }

  async function shareDigest() {
    const shareData = {
      title: `SIGNAL 10 — ${formatEdition(digest.edition)}`,
      text: `今日の生成AIニュース1位: ${digest.stories[0]?.title || ''}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The native share sheet can be cancelled without an error state in the UI.
    }
  }

  const dialogOpen = Boolean(selectedStory || notificationOpen);

  return (
    <>
    <main id="top" {...(dialogOpen ? { inert: true, 'aria-hidden': true } : {})}>
      <a className="skip-link" href="#ranking">ランキングへスキップ</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Signal 10 ホーム">
          <span className="brand-mark">S10</span>
          <span>SIGNAL 10</span>
        </a>
        <p className="edition">MORNING AI BRIEF</p>
        <div className="header-actions">
          <button aria-label="この朝刊を共有" className="share-button" onClick={shareDigest} type="button">{copied ? 'コピー済み' : '共有'}</button>
          <button className="notify-button" onClick={openNotifications} type="button"><span className="button-dot" /> 通知を受け取る</button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{formatEdition(digest.edition).toUpperCase()} · 06:30 JST</p>
          <h1>生成AIの「今日」を、<br /><em>10本だけ。</em></h1>
        </div>
        <div className="hero-aside">
          <div className="hero-note">
            <span className="live-dot" />
            <p><strong>{digest.successfulSources}/{digest.checkedSources} SOURCES CONNECTED</strong><br />公式発表・報道・研究を横断</p>
          </div>
          <p className="editorial-note">{digest.editorialNote}</p>
          <a href="#ranking">今日のランキングへ <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section className="ticker" aria-label="収集状況">
        <span className={digest.status === 'degraded' ? 'edition-state--degraded' : ''}>
          {digest.status === 'degraded' ? 'PARTIAL EDITION' : 'LIVE EDITION'}
        </span>
        <p>{digest.successfulSources}件の情報源に接続</p>
        <i />
        <p>{digest.candidateCount}件から10本を選定</p>
        <i />
        <p>重複トピックを統合</p>
        <i />
        <p>最終更新 {formatTime(digest.generatedAt)}</p>
        {remoteState === 'fallback' && <span className="fallback-chip">保存版を表示中</span>}
      </section>

      <nav className="category-nav" aria-label="カテゴリで絞り込む">
        {CATEGORY_LABELS.map((label) => {
          const count = label === 'すべて' ? digest.stories.length : digest.stories.filter((story) => story.category === label).length;
          return (
            <button
              aria-pressed={category === label}
              className={category === label ? 'active' : ''}
              key={label}
              onClick={() => setCategory(label)}
              type="button"
            >
              {label}<sup>{count}</sup>
            </button>
          );
        })}
      </nav>

      {leadStories.length > 0 ? (
        <section className={`top-grid top-grid--${leadStories.length}`} id="ranking" aria-label="重要ニュース上位">
          <StoryButton story={leadStories[0]} variant="feature" onOpen={openStory} />
          <div className="side-stack">
            {leadStories.slice(1).map((story) => <StoryButton key={story.id} story={story} variant="compact" onOpen={openStory} />)}
          </div>
        </section>
      ) : (
        <section className="empty-state" id="ranking"><p>このカテゴリのニュースは本日の上位10件にありません。</p></section>
      )}

      {remainingStories.length > 0 && (
        <section className="ranking-section" aria-labelledby="ranking-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">TODAY&apos;S RANKING</p>
              <h2 id="ranking-title">続けて読む</h2>
            </div>
            <p>重要度・話題の広がり・新しさをもとに順位付け</p>
          </div>
          <div className="ranking-list">
            {remainingStories.map((story) => <StoryButton key={story.id} story={story} variant="row" onOpen={openStory} />)}
          </div>
        </section>
      )}

      <section className="method-section">
        <p className="section-kicker">HOW IT WORKS</p>
        <h2>多く集めて、<br />少なく届ける。</h2>
        <div className="method-grid">
          <div><span>01</span><h3>広く集める</h3><p>AI企業の公式発表、主要メディア、研究フィードを毎日巡回します。</p></div>
          <div><span>02</span><h3>同じ話題を束ねる</h3><p>似た見出しやリンクを統合し、一つの出来事として複数ソースで確認します。</p></div>
          <div><span>03</span><h3>重要度で並べる</h3><p>公式性、影響範囲、報道の広がり、新しさを採点し、上位10件を選びます。</p></div>
          <div><span>04</span><h3>根拠を確かめる</h3><p>原文と各要点を照合し、確認できない生成文は原文表示へ安全に戻します。</p></div>
        </div>
      </section>

      <footer>
        <a className="brand brand--footer" href="#top"><span className="brand-mark">S10</span><span>SIGNAL 10</span></a>
        <p>GENERATIVE AI, CURATED DAILY.<br />毎朝 06:30 JST 更新</p>
        <p className="disclaimer">すべての公開情報を完全に網羅することは保証できません。取得失敗は記録し、主要な公式情報源を優先して補完します。</p>
      </footer>

    </main>
    {selectedStory && <StoryDetail story={selectedStory} onClose={closeStory} />}
    {notificationOpen && <NotificationPanel digest={digest} onClose={closeNotifications} />}
    </>
  );
}
