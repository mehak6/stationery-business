# Bol Bahi Android

Standalone Bol Bahi application, package `com.mehak.bolbahi`, built with Capacitor 8.
The earlier `com.mehak.stationery` test build is a separate app and is not overwritten.
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
Admin: `mehakaggarwal70@gmail.com`. Everyone starts at the sales counter; opening admin details requires the admin password again.
The Android admin screen loads stock and date-filtered sales online, without mounting Inventory Pro or its PouchDB offline storage. It locks when backgrounded.
Test Staff login, Admin login, sales counter, product search/suggestions, stock, date-filtered sales, and staff management.
Check Android Back and opening the app again after backgrounding.
Use an unsaved draft to check quantities and prices without creating artificial live sales.

Native Hindi speech uses the phone's recognition service and asks for microphone permission only when tapped.
Review the transcription and items before saving. If recognition is unavailable or permission is declined, manual entry remains available.
Staff use mobile number + password; no SMS provider is required. The number is an admin-provisioned identifier, not SMS-verified ownership.
Deploy `supabase/functions/create-staff` to the existing Supabase project before creating staff from the app. It validates the caller's JWT and database admin role, then creates and approves an account using server-only service-role credentials. Built-in Supabase function secrets supply credentials; never embed them in the APK.
Staff accounts use a reserved `staff.<international digits>@bolbahi.invalid` internal Auth identifier, plus their phone number. No email or SMS is delivered. Do not use public signup or email recovery for these accounts; the admin provisions them.
Android cloud backup is disabled for this app's private data. The older Inventory Pro application remains separate and can retain its old offline data.

Legacy full Inventory Pro tools remain available on the web admin route and the old app; they are not part of the standalone staff app's online dashboard.

## Voice matching

Common Hindi/Hinglish product words are normalised against catalogue names and configured voice aliases. `दो पेंसिल` matches a unique `PENCIL` item and quantity 2. Duplicate names and variants stay unselected with suggestions. Brand, colour, spoken rates and pack conversions must not be silently discarded. Staff can search in Hindi or English and correct the draft before saving.

Version 1.2 adds Hindi labels in the Android stock screen and sales picker, plus an admin **Hindi names** tab with search and pagination. The first Hindi voice alias is the display label; the original inventory name remains alongside it. `lib/hindi-product-names.json` covers all 132 catalogue rows checked during this release. Their Hindi aliases were also saved to the existing `products.voice_aliases` field. New inventory products can receive spoken names through the admin editor.

Unpunctuated orders such as `दो पेंसिल तीन पेन एक रबड़` split into separate draft rows only when there is a unique exact segmentation. Conjunctions inside a full product name are preserved. Unknown clauses and duplicate names still require correction. Price-specific aliases such as `तीस वाली डायरी` identify the variant without treating 30 as the quantity.

Release validation: 51 automated tests, TypeScript check, static Android build, and debug APK build passed. On the S24, an unsaved typed order with three products produced quantities 2/3/1 and the correct Hindi product selections. No live sale was saved. Live spoken recognition should still be checked by the operator. Of 132 catalogue names, 126 matched uniquely; the six rows for duplicate CAR, DIARY @60 and SPINNER @100 names intentionally require selection.
