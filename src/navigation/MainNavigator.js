import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocalSvg } from 'react-native-svg/css';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { useNotifications } from '../hooks/useNotifications';
import { CoachMarksOverlay } from '../components';
import { useUI } from '../context/UIContext';

import {
  HistoryScreen,
  SettingsScreen,
  ForcedPasswordChangeScreen,
  VisitDetailScreen,
  DailyFortuneScreen,
  DailyFortuneDrawScreen,
  NoticeDetailScreen,
  NewsScreen,
  TicketScreen,
  BugReportScreen,
  BugReportDetailScreen,
  PasswordResetScreen,
  DeleteAccountScreen,
} from '../screens';
import { useAuth } from '../hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const COACH_STEPS = [
  {
    key: 'tab-home',
    route: 'Home',
    title: '서랍 보관함',
    description: '방문 기록과 타로 기록이 모이는 첫 화면이에요. 오래된 서랍을 열듯 기록을 확인할 수 있어요.',
    allowTargetPress: true,
  },
  {
    key: 'home-archive-mode',
    route: 'Home',
    title: '서랍 기록 구분',
    description: 'ON/OFF/ALL 버튼으로 작성된 기록과 개인 기록을 나누어 볼 수 있어요.',
    interactive: true,
  },
  {
    key: 'home-time-filter',
    route: 'Home',
    title: '기간 필터',
    description: '전체, 연도별, 월별 필터로 원하는 시점의 기록을 빠르게 찾아보세요.',
    interactive: true,
  },
  {
    key: 'tab-ticket',
    route: 'Ticket',
    title: '쿠폰함',
    description: '보유 쿠폰과 사용할 수 있는 혜택을 확인하는 공간이에요.',
    allowTargetPress: true,
  },
  {
    key: 'tab-fortune',
    route: 'DailyFortune',
    title: '오늘의 운세',
    description: '하루의 흐름이 궁금할 때 타로 운세를 뽑아볼 수 있어요.',
    allowTargetPress: true,
  },
  {
    key: 'tab-notice',
    route: 'News',
    title: '소식',
    description: '공지, 이벤트, 새 알림을 확인하는 게시판이에요.',
    allowTargetPress: true,
  },
  {
    key: 'tab-settings',
    route: 'Settings',
    title: '설정',
    description: '계정 정보, 비밀번호, 문의 내역, 앱 가이드를 다시 확인할 수 있어요.',
    allowTargetPress: true,
  },
  {
    key: 'tab-home',
    route: 'Home',
    title: '가이드 완료',
    description: '언제든 설정에서 앱 이용 가이드를 다시 볼 수 있어요. 이제 서랍을 열어 기록을 살펴보세요.',
    allowTargetPress: true,
  },
];

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

const CoachableTabButton = ({ onCaptureFrame, ...props }) => {
  const ref = useRef(null);

  const captureFrame = () => {
    if (!ref.current || !onCaptureFrame) return;

    ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onCaptureFrame({ x, y, width, height });
    });
  };

  useEffect(() => {
    const firstCapture = setTimeout(captureFrame, 0);
    const secondCapture = setTimeout(captureFrame, 120);

    return () => {
      clearTimeout(firstCapture);
      clearTimeout(secondCapture);
    };
  }, [onCaptureFrame]);

  return <TouchableOpacity ref={ref} {...props} onLayout={captureFrame} onPressIn={captureFrame} />;
};

const tabIcon = (source, hasNotification = false) => ({ focused }) => (
  <TabIcon source={source} focused={focused} hasNotification={hasNotification} />
);

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

  const captureTabRootOffset = useCallback(() => {
    if (!tabRootRef.current) return;

    tabRootRef.current.measureInWindow((x, y) => {
      setTabRootWindowOffset({ x, y });
      setIsTabRootOffsetReady(true);
    });
  }, []);

  const registerFrame = useCallback((key, frame) => {
    if (!frame || frame.width <= 0 || frame.height <= 0) return;

    if (!isTabRootOffsetReady) {
      requestAnimationFrame(captureTabRootOffset);
      return;
    }

    const normalizedFrame = {
      ...frame,
      x: Math.max(0, frame.x - tabRootWindowOffset.x),
      y: Math.max(0, frame.y - tabRootWindowOffset.y),
    };

    setFrames((prev) => ({ ...prev, [key]: normalizedFrame }));
  }, [captureTabRootOffset, isTabRootOffsetReady, tabRootWindowOffset.x, tabRootWindowOffset.y]);

  const navigateToStep = useCallback((step) => {
    if (step?.route) navRef.current?.navigate(step.route);
  }, []);

  useEffect(() => {
    if (!showCoachMarks || !coachMarksSessionId) return;

    setStepIndex(0);
    setFrames({});
    setIsTabRootOffsetReady(false);

    requestAnimationFrame(() => {
      captureTabRootOffset();
      navigateToStep(COACH_STEPS[0]);
    });
  }, [showCoachMarks, coachMarksSessionId, captureTabRootOffset, navigateToStep]);

  const stepsWithFrame = useMemo(
    () => COACH_STEPS.map((step) => ({ ...step, frame: frames[step.key] })),
    [frames]
  );
  const currentStep = stepsWithFrame[stepIndex];
  const isCoachVisible = showCoachMarks && !!currentStep?.frame;

  useEffect(() => {
    if (!showCoachMarks || currentStep?.frame) return undefined;

    const retryFrameCapture = setInterval(() => {
      captureTabRootOffset();
      navigateToStep(currentStep);
    }, 250);

    return () => clearInterval(retryFrameCapture);
  }, [showCoachMarks, currentStep, captureTabRootOffset, navigateToStep]);

  const finishCoach = useCallback(() => {
    completeCoachMarks();
    setStepIndex(0);
  }, [completeCoachMarks]);

  const moveToStep = useCallback((nextIndex) => {
    if (nextIndex < 0) return;
    if (nextIndex >= stepsWithFrame.length) {
      finishCoach();
      return;
    }

    const nextStep = stepsWithFrame[nextIndex];
    navigateToStep(nextStep);
    requestAnimationFrame(captureTabRootOffset);
    setStepIndex(nextIndex);
  }, [captureTabRootOffset, finishCoach, navigateToStep, stepsWithFrame]);

  const advanceStep = useCallback((expectedStepKey) => {
    const current = stepsWithFrame[stepIndex];
    if (!current) return;
    if (expectedStepKey && current.key !== expectedStepKey) return;
    moveToStep(stepIndex + 1);
  }, [moveToStep, stepIndex, stepsWithFrame]);

  const previousStep = useCallback(() => {
    moveToStep(stepIndex - 1);
  }, [moveToStep, stepIndex]);

  const onCoachTargetPress = useCallback(() => {
    const current = stepsWithFrame[stepIndex];
    if (!current) return;

    navigateToStep(current);
    if (current.interactive || current.allowTargetPress) {
      advanceStep(current.key);
    }
  }, [advanceStep, navigateToStep, stepIndex, stepsWithFrame]);

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
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-home', frame)} />,
          }}
        >
          {(props) => (
            <HistoryScreen
              {...props}
              onCaptureCoachFrame={registerFrame}
              currentCoachStepKey={stepsWithFrame[stepIndex]?.key}
              advanceCoachStep={advanceStep}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="Ticket"
          component={TicketScreen}
          options={{
            tabBarLabel: '쿠폰',
            tabBarIcon: tabIcon(TAB_ICONS.ticket),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-ticket', frame)} />,
          }}
        />
        <Tab.Screen
          name="DailyFortune"
          component={DailyFortuneScreen}
          options={{
            tabBarLabel: '운세',
            tabBarIcon: tabIcon(TAB_ICONS.ritual),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-fortune', frame)} />,
          }}
        />
        <Tab.Screen
          name="News"
          component={NewsScreen}
          options={{
            tabBarLabel: '소식',
            tabBarIcon: tabIcon(TAB_ICONS.notice, hasAnyUnread),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-notice', frame)} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: '설정',
            tabBarIcon: tabIcon(TAB_ICONS.tune),
            tabBarButton: (props) => <CoachableTabButton {...props} onCaptureFrame={(frame) => registerFrame('tab-settings', frame)} />,
          }}
        />
      </Tab.Navigator>

      {isCoachVisible && (
        <CoachMarksOverlay
          steps={stepsWithFrame}
          stepIndex={stepIndex}
          onNext={() => advanceStep()}
          onPrevious={previousStep}
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
