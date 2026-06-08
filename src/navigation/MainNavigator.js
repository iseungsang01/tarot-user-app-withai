import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalSvg } from 'react-native-svg/css';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { useNotifications } from '../hooks/useNotifications';

import DailyFortuneDrawScreen from '../screens/fortune/DailyFortuneDrawScreen';
import DailyFortuneScreen from '../screens/fortune/DailyFortuneScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import VisitDetailScreen from '../screens/history/VisitDetailScreen';
import NewsScreen from '../screens/news/NewsScreen';
import NoticeDetailScreen from '../screens/notice/NoticeDetailScreen';
import BugReportDetailScreen from '../screens/settings/BugReportDetailScreen';
import BugReportScreen from '../screens/settings/BugReportScreen';
import DeleteAccountScreen from '../screens/settings/DeleteAccountScreen';
import ForcedPasswordChangeScreen from '../screens/settings/ForcedPasswordChangeScreen';
import PasswordResetScreen from '../screens/settings/PasswordResetScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import TicketScreen from '../screens/ticket/TicketScreen';
import { useAuth } from '../hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  archive: require('../../assets/tarot-cellar/icon-archive.svg'),
  ticket: require('../../assets/tarot-cellar/icon-ticket.svg'),
  ritual: require('../../assets/tarot-cellar/icon-ritual.svg'),
  notice: require('../../assets/tarot-cellar/icon-notice.svg'),
  tune: require('../../assets/tarot-cellar/icon-tune.svg'),
};

const TabIcon = ({ source, focused, hasNotification }) => (
  <View style={styles.iconContainer}>
    <LocalSvg
      asset={source}
      width={20}
      height={20}
      style={[
        styles.iconImage,
        { opacity: focused ? 1 : 0.68 },
        focused && styles.iconImageActive,
      ]}
    />
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

const tabIcon = (source, hasNotification = false) => ({ focused }) => (
  <TabIcon source={source} focused={focused} hasNotification={hasNotification} />
);

const TabNavigator = () => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.tabRoot}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          unmountOnBlur: true,
          tabBarStyle: {
            backgroundColor: 'rgba(9,0,13,0.94)',
            borderTopColor: 'rgba(200,163,64,0.18)',
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: insets.bottom,
            paddingTop: 4,
            height: 64 + insets.bottom,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.24,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarActiveTintColor: DrawerTheme.antiqueGold,
          tabBarInactiveTintColor: 'rgba(142,122,154,0.58)',
          tabBarLabelStyle: {
            fontSize: 9.5,
            fontWeight: '600',
            marginBottom: insets.bottom > 0 ? 0 : 3,
            letterSpacing: 0.2,
          },
          tabBarItemStyle: {
            minWidth: 0,
            paddingHorizontal: 0,
          },
        }}
        sceneContainerStyle={{ backgroundColor: DrawerTheme.bgBlackPurple }}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: '서랍',
            tabBarIcon: tabIcon(TAB_ICONS.archive),
          }}
          component={HistoryScreen}
        />
        <Tab.Screen
          name="Ticket"
          component={TicketScreen}
          options={{
            tabBarLabel: '쿠폰',
            tabBarIcon: tabIcon(TAB_ICONS.ticket),
          }}
        />
        <Tab.Screen
          name="DailyFortune"
          component={DailyFortuneScreen}
          options={{
            tabBarLabel: '운세',
            tabBarIcon: tabIcon(TAB_ICONS.ritual),
          }}
        />
        <Tab.Screen
          name="News"
          component={NewsScreen}
          options={{
            tabBarLabel: '소식',
            tabBarIcon: tabIcon(TAB_ICONS.notice, hasAnyUnread),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: '설정',
            tabBarIcon: tabIcon(TAB_ICONS.tune),
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

const MainNavigator = () => {
  const { customer } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={customer?.must_change_password ? 'ForcedPasswordChange' : 'MainTabs'}
    >
      <Stack.Screen name="ForcedPasswordChange" component={ForcedPasswordChangeScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="DailyFortuneDraw" component={DailyFortuneDrawScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReport" component={BugReportScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BugReportDetail" component={BugReportDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabRoot: { flex: 1 },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  iconImageActive: {
    shadowColor: DrawerTheme.brassHighlight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 5,
  },
  redDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8A2D3B',
    borderWidth: 1,
    borderColor: Colors.purpleMid,
  },
});

export default MainNavigator;
