import { View } from 'react-native';

import { Initial } from '@/components/family-ui';
import { Group, Row, Screen, Section, Separator } from '@/components/primitives';
import { QueryView } from '@/components/states';
import { useOpen } from '@/lib/nav';
import { useFamily } from '@/services/queries';
import { useAppState } from '@/state/app-state';

export default function Family() {
  const family = useFamily();
  const { family: f0 } = useAppState();
  const features = f0?.features;
  const open = useOpen();

  return (
    <Screen>
      <Section title="Children">
        <QueryView query={family} skeletonRows={2}>
          {(f) => {
            const kids = f.children;
            if (kids.length === 0) {
              return (
                <Group>
                  <Row
                    icon="person"
                    title={f.childrenError ? "We couldn't load your children right now" : 'No children linked yet'}
                    subtitle="Contact the school office to link your children."
                    showChevron={false}
                  />
                </Group>
              );
            }
            return (
              <Group>
                {kids.map((c, i) => (
                  <View key={c.id}>
                    {i > 0 && <Separator inset={72} />}
                    <Row
                      leading={<Initial child={c} size={40} />}
                      title={c.name}
                      subtitle={c.grade ?? undefined}
                      onPress={() => open(`child/${c.id}`)}
                    />
                  </View>
                ))}
              </Group>
            );
          }}
        </QueryView>
      </Section>

      <Section title="School">
        <Group>
          {[
            features?.documents && <Row icon="document" title="Documents" onPress={() => open('documents')} />,
            features?.links && <Row icon="link" title="Quick links" subtitle="FACTS and other school sites" onPress={() => open('links')} />,
            features?.volunteer && <Row icon="volunteer" title="Volunteer" onPress={() => open('volunteer')} />,
            features?.community && <Row icon="heart" title="Community" subtitle="Teacher wish lists and favorites" onPress={() => open('community')} />,
            <Row icon="phone" title="Contact school" onPress={() => open('contact')} />,
          ]
            .filter(Boolean)
            .map((row, i) => (
              <View key={i}>
                {i > 0 && <Separator inset={50} />}
                {row}
              </View>
            ))}
        </Group>
      </Section>

      <Section title="Account">
        <Group>
          <Row icon="settings" title="Settings" subtitle={family.data?.user.email} onPress={() => open('settings')} />
        </Group>
      </Section>
    </Screen>
  );
}
