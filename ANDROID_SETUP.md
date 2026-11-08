# Bol Bahi Android

Installable Android application, package `com.mehak.stationery`, built with Capacitor 8.
Screens are bundled inside the APK; inventory and account permissions use the existing Supabase project.
An internet connection is required to verify access and save counter sales.

## Build

Requires Node 22+, Java 21 and Android SDK 36. Android Studio provides Java and SDK management.

```powershell
npm ci
npm run android:sync
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\android\gradlew.bat -p android assembleDebug
```

Use the same public Supabase URL and anon key as the website in `.env.local`.
Never place a service-role key in the app.
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
This is a debug-signed test APK. Store distribution needs a separately protected release signing key and release build.
Do not commit signing keys. Future APK updates must use the same signing key and a higher version code.

## Phone validation

Install over authorized USB debugging with `adb install -r <apk>`.
The new application has its own login session; sign in directly on the phone.
Admin: `mehakaggarwal70@gmail.com`. Staff accounts still require admin approval.
Test Dashboard, Products, Quick Sale, Party, Ledger, Reports, staff management, and voice counter.
Check Android Back and opening the app again after backgrounding.
Use an unsaved draft to check quantities and prices without creating artificial live sales.

Native Hindi speech uses the phone's recognition service and asks for microphone permission only when tapped.
Review the transcription and items before saving. If recognition is unavailable or permission is declined, manual entry remains available.
Phone-number login still requires configuring an SMS provider in Supabase.
Android cloud backup is disabled for this app's private data. Use separate staff/admin devices or Android profiles where the admin offline cache must not be shared.

Browser-based downloads and printing from legacy admin tools need separate device verification; opening a tab alone does not verify exports or restore operations.
