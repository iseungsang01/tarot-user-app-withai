import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useNotifications } from '../hooks/useNotifications';

// Screens
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VisitDetailScreen from '../screens/VisitDetailScreen';
import DailyFortuneScreen from '../screens/DailyFortuneScreen';
import AIChatHistoryScreen from '../screens/AIChatHistoryScreen';
import CouponScreen from '../screens/CouponScreen';
import StampScreen from '../screens/StampScreen';
import NoticeScreen from '../screens/NoticeScreen';
import NoticeDetailScreen from '../screens/NoticeDetailScreen';
import VoteScreen from '../screens/VoteScreen';
import BugReportScreen from '../screens/BugReportScreen';
import BugReportDetailScreen from '../screens/BugReportDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ emoji, hasNotification }) => (
  <View style={styles.iconContainer}>
    <Text style={styles.iconEmoji}>{emoji}</Text>
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

const tabIcon = (emoji, hasNotification = false) => () => (
  <TabIcon emoji={emoji} hasNotification={hasNotification} />
);

const TabNavigator = () => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        unmountOnBlur: true,
        tabBarStyle: {
          backgroundColor: Colors.purpleMid,
          borderTopColor: Colors.gold,
          borderTopWidth: 2,
          paddingBottom: insets.bottom,
          paddingTop: 5,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.lavender,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: insets.bottom > 0 ? 0 : 5,
        },
      }}
      sceneContainerStyle={{
        backgroundColor: Colors.purpleDark,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HistoryScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: tabIcon('🏠'),
        }}
      />
      <Tab.Screen
        name="DailyFortune"
        component={DailyFortuneScreen}
        options={{
          tabBarLabel: '운세',
          tabBarIcon: tabIcon('🍀'),
        }}
      />
      <Tab.Screen
        name="Notice"
        component={NoticeScreen}
        options={{
          tabBarLabel: '공지',
          tabBarIcon: tabIcon('📢', hasAnyUnread),
        }}
      />
      <Tab.Screen
        name="Vote"
        component={VoteScreen}
        options={{
          tabBarLabel: '투표',
          tabBarIcon: tabIcon('🗳️'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: tabIcon('⚙️'),
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AIChatHistory" component={AIChatHistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Coupon" component={CouponScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Stamp" component={StampScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReport" component={BugReportScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReportDetail" component={BugReportDetailScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 24,
  },
  redDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    borderWidth: 1,
    borderColor: Colors.purpleMid,
  },
});

export default MainNavigator;
