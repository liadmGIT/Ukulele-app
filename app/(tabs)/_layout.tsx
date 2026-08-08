import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/ui/ThemeProvider';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function tabIcon(name: IconName) {
  const Icon = ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon('calendar-today') }}
      />
      <Tabs.Screen
        name="chords/index"
        options={{ title: t('tabs.chords'), tabBarIcon: tabIcon('music-circle-outline') }}
      />
      <Tabs.Screen
        name="songs/index"
        options={{ title: t('tabs.songs'), tabBarIcon: tabIcon('playlist-music-outline') }}
      />
      <Tabs.Screen
        name="practice/index"
        options={{ title: t('tabs.practice'), tabBarIcon: tabIcon('metronome') }}
      />
      <Tabs.Screen
        name="progress/index"
        options={{ title: t('tabs.progress'), tabBarIcon: tabIcon('chart-line') }}
      />
    </Tabs>
  );
}
