import { useCallback, useEffect, useState } from 'react';
import {
  getPwaInstallState,
  promptPwaInstall,
  subscribePwaInstall,
} from '../utils/pwaInstallCapture.js';

export default function usePwaInstall() {
  const [state, setState] = useState(() => getPwaInstallState());

  useEffect(() => subscribePwaInstall(setState), []);

  const promptInstall = useCallback(async () => promptPwaInstall(), []);

  return {
    canInstall: state.canInstall,
    isInstalled: state.isInstalled,
    promptInstall,
  };
}
