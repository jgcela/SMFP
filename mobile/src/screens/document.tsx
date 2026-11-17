import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button, Group, haptic, Row, Screen, Section, Separator, Text } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { longDate } from '@/lib/dates';
import { api, ApiError } from '@/services/api';
import { useDocuments } from '@/services/queries';
import { spacing } from '@/theme/tokens';

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kind(contentType: string, fileName: string): string {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType.startsWith('image/')) return 'Image';
  const ext = fileName.split('.').pop();
  return ext && ext !== fileName ? ext.toUpperCase() : 'File';
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDocuments();
  const d = q.data?.find((x) => x.id === id);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFile = async () => {
    setOpening(true);
    setError(null);
    // On the web, open the tab first so the browser does not block it as a pop-up.
    const tab = Platform.OS === 'web' ? window.open('', '_blank') : null;
    try {
      const { url } = await api.documentUrl(id);
      if (tab) tab.location.href = url;
      else await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      tab?.close();
      haptic('error');
      setError(err instanceof ApiError ? err.message : "We couldn't open the file. Try again.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Document' }} />
      <Screen>
        {!d ? (
          q.data ? (
            <EmptyState icon="error" title="This document is no longer available" body="The school may have removed it." />
          ) : q.isError ? (
            <EmptyState icon="error" title="We couldn't load this" action={{ label: 'Try again', onPress: () => void q.refetch() }} />
          ) : (
            <LoadingSkeleton />
          )
        ) : (
          <>
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.xs }}>
              <Text variant="footnote" tone="secondary">
                {d.category}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {d.title}
              </Text>
            </View>
            <Section>
              <Group>
                <Row icon="clock" title={`Updated ${longDate(new Date(d.updatedAt))}`} showChevron={false} />
                <Separator inset={50} />
                <Row icon="document" title={`${kind(d.contentType, d.fileName)}, ${size(d.sizeBytes)}`} subtitle={d.fileName} showChevron={false} />
              </Group>
            </Section>
            {d.description ? (
              <Section title="About this document">
                <Text variant="body">{d.description}</Text>
              </Section>
            ) : null}
            <Section footer="The link to the file works for a few minutes.">
              <View style={{ gap: spacing.sm }}>
                <Button label={`Open ${kind(d.contentType, d.fileName)}`} icon="document" loading={opening} onPress={() => void openFile()} />
                {error ? (
                  <Text variant="footnote" tone="danger" accessibilityRole="alert">
                    {error}
                  </Text>
                ) : null}
              </View>
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}
