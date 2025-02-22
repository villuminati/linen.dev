import React, { useEffect, useState } from 'react';
import BlankLayout from '@linen/ui/BlankLayout';
import styles from './index.module.scss';
import Row from '@linen/ui/Row';
import RowSkeleton from '@linen/ui/RowSkeleton';
import { SerializedAccount, SerializedThread, Settings } from '@linen/types';
import LinenLogo from '@linen/ui/LinenLogo';
import useInfiniteScroll from 'react-infinite-scroll-hook';
import Modal from '@linen/ui/Modal';
import Nav from '@linen/ui/Nav';
import { FiHash } from '@react-icons/all-files/fi/FiHash';
import { getHomeUrl } from '@linen/utilities/home';
import { getThreadUrl, qs } from '@linen/utilities/url';
import { timeAgo } from '@linen/utilities/date';
import { FiMenu } from '@react-icons/all-files/fi/FiMenu';
import { signOut, useSession } from '@linen/auth/client';
import Link from 'next/link';

enum ModalView {
  NONE,
  MENU,
}

function Communities({ communities }: { communities: SerializedAccount[] }) {
  return (
    <>
      <Nav.Group>Communities</Nav.Group>
      {communities.map((community) => {
        return (
          <a
            href={getHomeUrl(community)}
            key={community.id}
            target="_blank"
            rel="noreferrer"
          >
            <Nav.Item>
              <FiHash />
              {community.name}
            </Nav.Item>
          </a>
        );
      })}
    </>
  );
}

const FEED_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://static.main.linendev.com/api/feed'
    : '/api/feed';

export default function Feed() {
  const [modal, setModal] = useState<ModalView>(ModalView.NONE);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [threads, setThreads] = useState<SerializedThread[]>([]);
  const [settings, setSettings] = useState<Settings[]>([]);
  const [communities, setCommunities] = useState<SerializedAccount[]>([]);
  const close = () => setModal(ModalView.NONE);
  const session = useSession();

  async function fetchFeed() {
    setLoading(true);
    fetch(`${FEED_URL}?${qs({ cursor })}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.json())
      .then(
        ({
          threads: newThreads,
          settings: newSettings,
          communities: newCommunities,
          cursor,
        }: {
          threads: SerializedThread[];
          settings: Settings[];
          communities: SerializedAccount[];
          cursor: string | null;
        }) => {
          setLoading(false);
          setCursor(cursor || undefined);
          setThreads((threads) => [...threads, ...newThreads]);
          setSettings((settings) => {
            const ids = settings.map((setting) => setting.communityId);
            const settingsToAdd = newSettings.filter(
              (setting) => !ids.includes(setting.communityId)
            );
            return [...settings, ...settingsToAdd];
          });
          setCommunities((communities) => {
            const ids = communities.map((community) => community.id);
            const communitiesToAdd = newCommunities.filter(
              (community) => !ids.includes(community.id)
            );
            return [...communities, ...communitiesToAdd];
          });
          setMore(!!cursor);
        }
      );
  }

  useEffect(() => {
    fetchFeed();
  }, []);

  const [sentryRef] = useInfiniteScroll({
    loading,
    hasNextPage: more,
    onLoadMore: fetchFeed,
    disabled: loading || !more,
    rootMargin: '0px 0px 640px 0px',
    delayInMs: 0,
  });
  return (
    <BlankLayout>
      <div className={styles.grid}>
        <div className={styles.left}>
          <div className={styles.sticky}>
            <div className={styles.logo}>
              <LinenLogo /> <small>Feed</small>
            </div>
            <Nav>
              <Communities communities={communities.slice(0, 20)} />
            </Nav>
          </div>
        </div>
        <main className={styles.center}>
          <div className={styles.logo}>
            <LinenLogo /> <small>Feed</small>
            <FiMenu
              className={styles.menu}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setModal(ModalView.MENU);
              }}
            />
          </div>
          <div className={styles.description}>
            <p>
              <small>
                Linen is a chat platform built for communities.{' '}
                <a
                  className={styles.link}
                  href="https://linen.dev"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read more
                </a>
              </small>
            </p>
          </div>
          <div>
            {threads.map((thread) => {
              const community = communities.find(
                (community) => community.id === thread.channel?.accountId
              ) as SerializedAccount;
              const setting = settings.find(
                (setting) => setting.communityId === thread.channel?.accountId
              ) as Settings;
              const url = getThreadUrl({
                isSubDomainRouting: false,
                settings: setting,
                incrementId: thread.incrementId,
                slug: thread.slug,
                LINEN_URL: process.env.DEVELOPMENT
                  ? 'http://localhost:3000'
                  : 'https://www.linen.dev',
              });
              return (
                <a
                  className={styles.row}
                  href={url}
                  target="_blank"
                  key={thread.id}
                  rel="noreferrer"
                >
                  <Row
                    thread={thread}
                    currentUser={null}
                    isSubDomainRouting={false}
                    settings={setting}
                    showActions={false}
                    subheader={
                      <>
                        {timeAgo(Number(thread.lastReplyAt))}
                        <a
                          href={getHomeUrl(community)}
                          key={community.id}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.subheader}
                        >
                          #{community.name}
                        </a>
                      </>
                    }
                  />
                </a>
              );
            })}
          </div>
          <div ref={sentryRef} />
          {more &&
            [...Array(5)].map((_, index) => (
              <RowSkeleton key={`row-skeleton-${index}`} />
            ))}
        </main>
        <div className={styles.right}>
          <div className={styles.sticky}>
            <div className={styles.actions}>
              {session.status === 'authenticated' ? (
                <>
                  <Link className={styles.link} href="/getting-started">
                    Get started
                  </Link>
                  <a className={styles.link} onClick={() => signOut()}>
                    Sign out
                  </a>
                </>
              ) : (
                <>
                  <Link
                    className={styles.link}
                    href="/signin?callbackUrl=/feed"
                  >
                    Log in
                  </Link>
                  <Link
                    className={styles.link}
                    href="/signup?callbackUrl=/feed"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
            <h1>What is Linen?</h1>
            <p>
              <small>
                Linen is a real-time chat platform built for communities. We are
                SEO friendly while providing a modern chat experience.
              </small>
            </p>
            <h2>Forum and a real-time chat</h2>
            <p>
              <small>
                Information gets lost in real-time chat. Linen solves this by
                letting Google find your content. Our advanced threading model
                let you drag and drop messages and threads to reorganize your
                content.
              </small>
            </p>
            <a
              className={styles.link}
              href="https://linen.dev"
              target="_blank"
              rel="noreferrer"
            >
              Read more
            </a>
          </div>
        </div>
      </div>
      <Modal open={modal === ModalView.MENU} close={close} size="full">
        <div className={styles.modal}>
          <FiMenu className={styles.menu} onClick={close} />
          <Communities communities={communities} />
        </div>
      </Modal>
    </BlankLayout>
  );
}
