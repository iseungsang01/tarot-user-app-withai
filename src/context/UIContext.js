import { createContext, useCallback, useContext } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const startCoachMarks = useCallback(() => {}, []);
  const completeCoachMarks = useCallback(async () => {}, []);
  const triggerCoachMarks = useCallback(() => {}, []);

  return (
    <UIContext.Provider
      value={{
        showCoachMarks: false,
        coachMarksSessionId: null,
        uiLoading: false,
        completeCoachMarks,
        startCoachMarks,
        triggerCoachMarks,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
