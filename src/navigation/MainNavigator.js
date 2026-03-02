import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useNotifications } from '../hooks/useNotifications';
import { CoachMarksOverlay } from '../components';
import { useUI } from '../context/UIContext';

import {
  HistoryScreen,
  SettingsScreen,
  ForcedPasswordChangeScreen,
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
import { useAuth } from '../hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const COACH_STEPS = [
  { key: 'tab-home', title: '1) 홈 탭으로 이동', description: '네모로 강조된 홈 탭을 눌러 실제 홈 화면으로 이동해주세요.', requireTargetTap: true },
  { key: 'home-stamp', title: '2) 스탬프 확인', description: '홈 상단 요약의 스탬프 영역을 눌러 스탬프 화면으로 들어가 보세요.', requireTargetTap: true },
  { key: 'home-coupon', title: '3) 쿠폰 확인', description: '다시 홈으로 돌아온 뒤, 보유 쿠폰 영역을 눌러 쿠폰함으로 이동해 보세요.', requireTargetTap: true },
  { key: 'home-archive-mode', title: '4) ALL · ON · OFF 필터', description: '홈의 ALL/ON/OFF 버튼을 직접 눌러 기록 유형을 전환해 보세요.', requireTargetTap: true },
  { key: 'home-time-filter', title: '5) 전체 · 연도별 · 월별', description: '기간 필터를 눌러 원하는 시점의 기록만 빠르게 찾아보세요.', requireTargetTap: true },
  { key: 'tab-notice', title: '6) 공지 탭 탐색', description: '하단 공지 탭을 눌러 최신 공지/알림 목록으로 이동하세요.', requireTargetTap: true },
  { key: 'tab-settings', title: '7) 설정 탭 탐색', description: '하단 설정 탭을 눌러 계정/앱 설정 메뉴를 확인하세요.', requireTargetTap: true },
  { key: 'tab-home', title: '8) 가이드 종료', description: '다시 홈 탭으로 돌아오면 가이드가 완료됩니다.', requireTargetTap: true },
];

const STEP_ROUTE_MAP = {
  'tab-home': 'Home',
  'home-stamp': 'Home',
  'home-coupon': 'Home',
  'home-archive-mode': 'Home',
  'home-time-filter': 'Home',
  'tab-notice': 'Notice',
  'tab-settings': 'Settings',
};

const TabIcon = ({ emoji, hasNotification }) => (
  <View style={styles.iconContainer}>
    <Text style={styles.iconEmoji}>{emoji}</Text>
    {hasNotification && <View style={styles.redDot} />}
  </View>
);

const CoachableTabButton = ({ onCaptureFrame, ...props }) => {
  const ref = useRef(null);

  const captureFrame = () => {
    if (!ref.current || !onCaptureFrame) return;

    ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onCaptureFrame({ x, y, width, height });
    });
  };

  return <TouchableOpacity ref={ref} {...props} onLayout={captureFrame} onPressIn={captureFrame} />;
};

const tabIcon = (emoji, hasNotification = false) => () => <TabIcon emoji={emoji} hasNotification={hasNotification} />;

const TabNavigator = () => {
  const { hasAnyUnread } = useNotifications();
  const insets = useSafeAreaInsets();
  const { showCoachMarks, coachMarksSessionId, completeCoachMarks } = useUI();
  const [stepIndex, setStepIndex] = useState(0);
  const [frames, setFrames] = useState({});
  const navRef = useRef(null);
  const tabRootRef = useRef(null);
  const [tabRootWindowOffset, setTabRootWindowOffset] = useState({ x: 0, y: 0 });
  const [isTabRootOffsetReady, setIsTabRootOffsetReady] = useState(false);
  const zeroFrameCountsRef = useRef({});

  const captureTabRootOffset = useCallback(() => {
    if (!tabRootRef.current) return;

    tabRootRef.current.measureInWindow((x, y) => {
      setTabRootWindowOffset({ x, y });
      setIsTabRootOffsetReady(true);
    });
  }, []);

  const registerFrame = (key, frame) => {
    if (!frame) return;

    if (!isTabRootOffsetReady) {
      return;
    }

    const isZeroFrame = frame.x === 0 && frame.y === 0;
    const nextZeroCount = isZeroFrame ? (zeroFrameCountsRef.current[key] || 0) + 1 : 0;
    zeroFrameCountsRef.current[key] = nextZeroCount;

    if (isZeroFrame && nextZeroCount >= 2) {
      console.warn(`[CoachMarks] Ignore repeated zero frame for "${key}"`, { frame, zeroCount: nextZeroCount });
      return;
    }

    const normalizedFrame = {
      ...frame,
      x: Math.max(0, frame.x - tabRootWindowOffset.x),
      y: Math.max(0, frame.y - tabRootWindowOffset.y),
    };

    setFrames((prev) => ({ ...prev, [key]: normalizedFrame }));
  };


  useEffect(() => {
    if (!showCoachMarks || !coachMarksSessionId) return;

    setStepIndex(0);
    setFrames({});
    zeroFrameCountsRef.current = {};

    requestAnimationFrame(() => {
      captureTabRootOffset();
    });
  }, [showCoachMarks, coachMarksSessionId, captureTabRootOffset]);

  const stepsWithFrame = useMemo(() => COACH_STEPS.map((step) => ({ ...step, frame: frames[step.key] })), [frames]);
  const currentStep = stepsWithFrame[stepIndex];
  const isCoachVisible = showCoachMarks && !!currentStep?.frame;

  useEffect(() => {
    if (!showCoachMarks) return;
    if (currentStep?.frame) return;

    const retryFrameCapture = requestAnimationFrame(() => {
      captureTabRootOffset();
    });

    const fallbackTimer = setTimeout(() => {
      if (!stepsWithFrame[stepIndex]?.frame) {
        console.warn('[CoachMarks] Missing step frame. Completing guide safely.', {
          stepIndex,
          stepKey: stepsWithFrame[stepIndex]?.key,
        });
        completeCoachMarks();
      }
    }, 300);

    return () => {
      cancelAnimationFrame(retryFrameCapture);
      clearTimeout(fallbackTimer);
    };
  }, [showCoachMarks, currentStep, stepIndex, stepsWithFrame, captureTabRootOffset, completeCoachMarks]);

  const finishCoach = () => {
    completeCoachMarks();
    setStepIndex(0);
  };

  const onCoachTargetPress = () => {
    const currentStep = stepsWithFrame[stepIndex];
    if (!currentStep) return;

    const routeName = STEP_ROUTE_MAP[currentStep.key];
    if (routeName) navRef.current?.navigate(routeName);

    if (stepIndex >= stepsWithFrame.length - 1) {
      finishCoach();
      return;
    }

    const nextIndex = stepIndex + 1;
    const nextStep = stepsWithFrame[nextIndex];
    const nextRouteName = STEP_ROUTE_MAP[nextStep.key];
    if (nextRouteName) navRef.current?.navigate(nextRouteName);
    setStepIndex(nextIndex);
  };

  return (
    <View
      ref={tabRootRef}
      style={styles.tabRoot}
      onLayout={() => {
        requestAnimationFrame(captureTabRootOffset);
      }}
    >
      <Tab.Navigator
        ref={navRef}
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
        sceneContainerStyle={{ backgroundColor: Colors.purpleDark }}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: '홈',
            tabBarIcon: tabIcon('🏠'),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-home', frame)} />,
          }}
        >
          {(props) => <HistoryScreen {...props} onCaptureCoachFrame={registerFrame} />}
        </Tab.Screen>
        <Tab.Screen
          name="DailyFortune"
          component={DailyFortuneScreen}
          options={{ tabBarLabel: '운세', tabBarIcon: tabIcon('🍀') }}
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
        <Tab.Screen name="Vote" component={VoteScreen} options={{ tabBarLabel: '투표', tabBarIcon: tabIcon('🗳️') }} />
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
          onNext={onCoachTargetPress}
          onTargetPress={onCoachTargetPress}
          onClose={finishCoach}
        />
      )}
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
  iconContainer: { position: 'relative', width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 24 },
  redDot: {
    position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ff4444', borderWidth: 1, borderColor: Colors.purpleMid,
  },
});

export default MainNavigator;
