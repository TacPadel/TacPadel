package com.TacPadel.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Dieser Befehl übergibt den neuen Link (Intent) an Capacitor,
        // sodass dein useEffect-Listener in der App.tsx ihn sofort sieht.
        setIntent(intent);
    }
}