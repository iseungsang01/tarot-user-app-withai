import React from 'react';
import { Text, Platform, View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useNotifications } from '../hooks/useNotifications';

// Screens
import HistoryScreen from '../screens/HistoryScreen';
import AIChatScreen from '../screens/AIChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VisitDetailScreen from '../screens/VisitDetailScreen';
import MembershipScreen from '../screens/MembershipScreen';
import ShopListScreen from '../screens/ShopListScreen';
import ShopContentsScreen from '../screens/ShopContentsScreen';
import DailyFortuneScreen from '../screens/DailyFortuneScreen';
import AIChatHistoryScreen from '../screens/AIChatHistoryScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * 탭 아이콘 컴포넌트 (빨간점 포함)
 */
const TabIcon = ({ emoji, hasNotification }) => (
  <View style={styles.iconContainer}>
    <Text style={styles.iconEmoji}>{emoji}</Text>
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

/**
 * 매장 네비게이터 (Stack)
 */
const ShopStack = createStackNavigator();
const ShopNavigator = () => (
  <ShopStack.Navigator screenOptions={{ headerShown: false }}>
    <ShopStack.Screen name="ShopList" component={ShopListScreen} />
    <ShopStack.Screen name="ShopContents" component={ShopContentsScreen} />
  </ShopStack.Navigator>
);

/**
 * 탭 네비게이터
 * 하단 탭 바로 주요 화면들 전환
 * ✅ SafeAreaInsets 적용으로 홈 버튼 영역 보호
 */
const TabNavigator = () => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        unmountOnBlur: true, // ✅ 탭 이동 시 화면 초기화 (다른 탭 갔다 오면 처음 상태로)
        tabBarStyle: {
          backgroundColor: Colors.purpleMid,
          borderTopColor: Colors.gold,
          borderTopWidth: 2,
          paddingBottom: insets.bottom, // ✅ 안전 영역만큼 패딩 추가
          paddingTop: 5,
          height: 60 + insets.bottom, // ✅ 높이도 안전 영역 고려
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.lavender,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: insets.bottom > 0 ? 0 : 5, // ✅ 홈 버튼이 있는 기기는 여백 조정
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
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" hasNotification={false} />
          ),
        }}
      />
      <Tab.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          tabBarLabel: 'AI 상담',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔮" hasNotification={false} />
          ),
        }}
      />
      <Tab.Screen
        name="DailyFortune"
        component={DailyFortuneScreen}
        options={{
          tabBarLabel: '운세',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🍀" hasNotification={false} />
          ),
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopNavigator}
        options={{
          tabBarLabel: '매장',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏪" hasNotification={hasAnyUnread} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" hasNotification={false} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * 메인 네비게이터
 * 로그인 후 화면들을 관리
 * TabNavigator + VisitDetailScreen (모달 형식)
 */
const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="VisitDetail"
        component={VisitDetailScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="AIChatHistory"
        component={AIChatHistoryScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Membership"
        component={MembershipScreen}
        options={{
          presentation: 'modal',
        }}
      />
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