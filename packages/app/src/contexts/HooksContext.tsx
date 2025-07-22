import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from 'react';
import { HookInfo, HookValidationResult } from '../types';

interface HooksState {
  selectedHook: HookInfo | null;
  hookValidation: HookValidationResult | null;
}

type HooksAction =
  | { type: 'SET_SELECTED_HOOK'; payload: HookInfo | null }
  | { type: 'SET_HOOK_VALIDATION'; payload: HookValidationResult | null };

const initialState: HooksState = {
  selectedHook: null,
  hookValidation: null,
};

function hooksReducer(state: HooksState, action: HooksAction): HooksState {
  switch (action.type) {
    case 'SET_SELECTED_HOOK':
      return { ...state, selectedHook: action.payload };
    case 'SET_HOOK_VALIDATION':
      return { ...state, hookValidation: action.payload };
    default:
      return state;
  }
}

interface HooksContextValue {
  // State
  selectedHook: HookInfo | null;
  hookValidation: HookValidationResult | null;

  // Actions
  selectHook: (hook: HookInfo | null) => void;
  validateHook: () => Promise<void>;
  clearHookSelection: () => void;
}

const HooksContext = createContext<HooksContextValue | undefined>(undefined);

export const useHooks = (): HooksContextValue => {
  const context = useContext(HooksContext);
  if (!context) {
    throw new Error('useHooks must be used within a HooksProvider');
  }
  return context;
};

interface HooksProviderProps {
  children: React.ReactNode;
}

export const HooksProvider: React.FC<HooksProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(hooksReducer, initialState);

  const selectHook = useCallback((hook: HookInfo | null) => {
    dispatch({ type: 'SET_SELECTED_HOOK', payload: hook });
  }, []);

  const validateHook = useCallback(async (): Promise<void> => {
    try {
      // Hook validation will be implemented in Phase 2.4
      // For now, just clear any existing validation
      dispatch({ type: 'SET_HOOK_VALIDATION', payload: null });
    } catch (error) {
      console.error('Failed to validate hook:', error);
    }
  }, []);

  const clearHookSelection = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_HOOK', payload: null });
    dispatch({ type: 'SET_HOOK_VALIDATION', payload: null });
  }, []);

  const value: HooksContextValue = {
    // State
    selectedHook: state.selectedHook,
    hookValidation: state.hookValidation,

    // Actions
    selectHook,
    validateHook,
    clearHookSelection,
  };

  return (
    <HooksContext.Provider value={value}>{children}</HooksContext.Provider>
  );
};
