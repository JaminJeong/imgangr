plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.imgangr"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.imgangr"
        minSdk = 26          // Android 8.0+ — 전체 기기의 95% 이상 커버
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")

    // WebViewAssetLoader — file:// 대신 https://appassets 로 서빙
    // (GPS · 카메라 · 마이크 등 보안 컨텍스트 필요 API 활성화)
    implementation("androidx.webkit:webkit:1.11.0")
}
