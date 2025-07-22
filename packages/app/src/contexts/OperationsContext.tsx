import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from 'react';
import { Operation, ErrorInfo, InfoMessage } from '../types';

interface OperationsState {
  pendingOperation: Operation | null;
  operationHistory: Operation[];
  errors: ErrorInfo[];
  infos: InfoMessage[];
}

type OperationsAction =
  | { type: 'SET_PENDING_OPERATION'; payload: Operation | null }
  | { type: 'ADD_OPERATION'; payload: Operation }
  | {
      type: 'UPDATE_OPERATION';
      payload: { id: string; updates: Partial<Operation> };
    }
  | { type: 'ADD_ERROR'; payload: Omit<ErrorInfo, 'id' | 'timestamp'> }
  | { type: 'ADD_INFO'; payload: Omit<InfoMessage, 'id' | 'timestamp'> }
  | { type: 'CLEAR_ERROR'; payload: number }
  | { type: 'CLEAR_INFO'; payload: number }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'CLEAR_ALL_INFOS' };

const initialState: OperationsState = {
  pendingOperation: null,
  operationHistory: [],
  errors: [],
  infos: [],
};

function operationsReducer(
  state: OperationsState,
  action: OperationsAction
): OperationsState {
  switch (action.type) {
    case 'SET_PENDING_OPERATION':
      return { ...state, pendingOperation: action.payload };
    case 'ADD_OPERATION':
      return {
        ...state,
        operationHistory: [action.payload, ...state.operationHistory].slice(
          0,
          100
        ), // Keep last 100
      };
    case 'UPDATE_OPERATION':
      return {
        ...state,
        operationHistory: state.operationHistory.map(op =>
          op.id === action.payload.id
            ? { ...op, ...action.payload.updates }
            : op
        ),
      };
    case 'ADD_ERROR': {
      const error: ErrorInfo = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      return {
        ...state,
        errors: [error, ...state.errors].slice(0, 10), // Keep last 10 errors
      };
    }
    case 'ADD_INFO': {
      const info: InfoMessage = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      return {
        ...state,
        infos: [info, ...state.infos].slice(0, 10), // Keep last 10 infos
      };
    }
    case 'CLEAR_ERROR':
      return {
        ...state,
        errors: state.errors.filter((_, index) => index !== action.payload),
      };
    case 'CLEAR_INFO':
      return {
        ...state,
        infos: state.infos.filter((_, index) => index !== action.payload),
      };
    case 'CLEAR_ALL_ERRORS':
      return { ...state, errors: [] };
    case 'CLEAR_ALL_INFOS':
      return { ...state, infos: [] };
    default:
      return state;
  }
}

interface OperationsContextValue {
  // State
  pendingOperation: Operation | null;
  operationHistory: Operation[];
  errors: ErrorInfo[];
  infos: InfoMessage[];

  // Actions
  startOperation: (
    operation: Omit<Operation, 'id' | 'timestamp' | 'status'>
  ) => string;
  completeOperation: (id: string, result?: unknown) => void;
  failOperation: (id: string, error: string) => void;
  addError: (
    title: string,
    message: string,
    type?: 'error' | 'warning'
  ) => void;
  addInfo: (title: string, message: string, type?: 'info' | 'success') => void;
  clearError: (index: number) => void;
  clearInfo: (index: number) => void;
  clearAllErrors: () => void;
  clearAllInfos: () => void;
}

const OperationsContext = createContext<OperationsContextValue | undefined>(
  undefined
);

export const useOperations = (): OperationsContextValue => {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperations must be used within an OperationsProvider');
  }
  return context;
};

interface OperationsProviderProps {
  children: React.ReactNode;
}

export const OperationsProvider: React.FC<OperationsProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(operationsReducer, initialState);

  const startOperation = useCallback(
    (operation: Omit<Operation, 'id' | 'timestamp' | 'status'>) => {
      const newOperation: Operation = {
        ...operation,
        id: Date.now().toString(),
        timestamp: new Date(),
        status: 'pending',
      };

      dispatch({ type: 'SET_PENDING_OPERATION', payload: newOperation });
      dispatch({ type: 'ADD_OPERATION', payload: newOperation });

      return newOperation.id;
    },
    []
  );

  const completeOperation = useCallback((id: string, result?: unknown) => {
    dispatch({
      type: 'UPDATE_OPERATION',
      payload: { id, updates: { status: 'completed', result } },
    });
    dispatch({ type: 'SET_PENDING_OPERATION', payload: null });
  }, []);

  const failOperation = useCallback((id: string, error: string) => {
    dispatch({
      type: 'UPDATE_OPERATION',
      payload: { id, updates: { status: 'failed', error } },
    });
    dispatch({ type: 'SET_PENDING_OPERATION', payload: null });
  }, []);

  const addError = useCallback(
    (title: string, message: string, type: 'error' | 'warning' = 'error') => {
      dispatch({ type: 'ADD_ERROR', payload: { title, message, type } });
    },
    []
  );

  const addInfo = useCallback(
    (title: string, message: string, type: 'info' | 'success' = 'info') => {
      dispatch({ type: 'ADD_INFO', payload: { title, message, type } });
    },
    []
  );

  const clearError = useCallback((index: number) => {
    dispatch({ type: 'CLEAR_ERROR', payload: index });
  }, []);

  const clearInfo = useCallback((index: number) => {
    dispatch({ type: 'CLEAR_INFO', payload: index });
  }, []);

  const clearAllErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
  }, []);

  const clearAllInfos = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_INFOS' });
  }, []);

  const value: OperationsContextValue = {
    // State
    pendingOperation: state.pendingOperation,
    operationHistory: state.operationHistory,
    errors: state.errors,
    infos: state.infos,

    // Actions
    startOperation,
    completeOperation,
    failOperation,
    addError,
    addInfo,
    clearError,
    clearInfo,
    clearAllErrors,
    clearAllInfos,
  };

  return (
    <OperationsContext.Provider value={value}>
      {children}
    </OperationsContext.Provider>
  );
};
