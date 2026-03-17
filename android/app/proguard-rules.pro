# WebView JavaScript 인터페이스 보존
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# WebViewAssetLoader
-keep class androidx.webkit.** { *; }

# 기본 Kotlin/Android 규칙
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
