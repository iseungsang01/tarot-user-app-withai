import React, { useMemo, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useNotifications } from '../hooks/useNotifications';
import { CoachMarksOverlay } from '../components';

// Screens
import {
  HistoryScreen,
  SettingsScreen,
  VisitDetailScreen,
  DailyFortuneScreen,
  AIChatHistoryScreen,
  CouponScreen,
  StampScreen,
  NoticeScreen,
  NoticeDetailScreen,
  VoteScreen,
  BugReportScreen,
  BugReportDetailScreen,
} from '../screens';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const COACH_STEPS = [
  { key: 'tab-home', title: '홈 탭', description: '서랍 기록과 스탬프 현황을 홈에서 확인할 수 있어요.' },
  { key: 'tab-notice', title: '공지 탭', description: '새 공지/알림은 공지 탭에서 빠르게 확인하세요.' },
  { key: 'tab-settings', title: '설정 탭', description: '설정 탭에서 계정/앱 설정을 관리할 수 있어요.' },
];

const TabIcon = ({ emoji, hasNotification }) => (
  <View style={styles.iconContainer}>
    <Text style={styles.iconEmoji}>{emoji}</Text>
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

const CoachableTabButton = ({ onCaptureFrame, ...props }) => {
  const ref = useRef(null);

  const captureFrame = () => {
    if (!ref.current || !onCaptureFrame) {
      return;
    }

    ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onCaptureFrame({ x, y, width, height });
      }
    });
  };

  return <TouchableOpacity ref={ref} {...props} onLayout={captureFrame} onPressIn={captureFrame} />;
};

const tabIcon = (emoji, hasNotification = false) => () => (
  <TabIcon emoji={emoji} hasNotification={hasNotification} />
);

const TabNavigator = ({ shouldShowCoachMarks, onCompleteCoachMarks }) => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [frames, setFrames] = useState({});

  const registerFrame = (key, frame) => {
    setFrames((prev) => ({ ...prev, [key]: frame }));
  };

  const stepsWithFrame = useMemo(() => (
    COACH_STEPS.map((step) => ({ ...step, frame: frames[step.key] }))
  ), [frames]);

  const isCoachVisible = shouldShowCoachMarks && !!stepsWithFrame[stepIndex]?.frame;

  const nextStep = () => {
    if (stepIndex >= stepsWithFrame.length - 1) {
      onCompleteCoachMarks();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  return (
    <View style={styles.tabRoot}>
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
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-home', frame)} />,
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
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-notice', frame)} />,
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
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-settings', frame)} />,
          }}
        />
      </Tab.Navigator>

      {isCoachVisible && (
        <CoachMarksOverlay
          steps={stepsWithFrame}
          stepIndex={stepIndex}
          onNext={nextStep}
          onClose={onCompleteCoachMarks}
        />
      )}
    </View>
  );
};

const MainNavigator = ({ shouldShowCoachMarks, onCompleteCoachMarks }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs">
        {() => <TabNavigator shouldShowCoachMarks={shouldShowCoachMarks} onCompleteCoachMarks={onCompleteCoachMarks} />}
      </Stack.Screen>
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
  tabRoot: { flex: 1 },
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
