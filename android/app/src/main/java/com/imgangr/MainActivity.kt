package com.imgangr

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.imgangr.databinding.ActivityMainBinding

/**
 * 임장기록 Android 앱 메인 액티비티
 *
 * WebViewAssetLoader를 사용해 웹 에셋을
 * https://appassets.androidplatform.net 으로 서빙한다.
 * file:// 대신 https 컨텍스트를 사용하므로
 * GPS · 카메라 · 마이크 Web API가 정상 동작한다.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    // ── WebView에서 들어오는 콜백 보관 ─────────────────────────
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermRequest: PermissionRequest? = null

    // ── 위치 권한 요청 ─────────────────────────────────────────
    private val locationPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
    }

    // ── 카메라 / 마이크 권한 요청 ──────────────────────────────
    private val mediaPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val request = pendingWebPermRequest ?: return@registerForActivityResult
        if (results.values.all { it }) request.grant(request.resources)
        else request.deny()
        pendingWebPermRequest = null
    }

    // ── 파일 선택기 (사진 첨부) ────────────────────────────────
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        pendingFileCallback?.onReceiveValue(uris.toTypedArray())
        pendingFileCallback = null
    }

    // ─────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupWebView()
        setupBackNavigation()

        // assets/ 루트를 https://appassets.androidplatform.net/ 으로 서빙
        binding.webview.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // ── WebViewClient: 에셋 요청을 로컬 파일로 인터셉트 ──
        binding.webview.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
        }

        // ── WebChromeClient: GPS · 카메라 · 마이크 · 파일 처리 ─
        binding.webview.webChromeClient = object : WebChromeClient() {

            /** navigator.geolocation.watchPosition() 호출 시 */
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                val fineLocation = Manifest.permission.ACCESS_FINE_LOCATION
                if (ContextCompat.checkSelfPermission(this@MainActivity, fineLocation)
                    == PackageManager.PERMISSION_GRANTED
                ) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeoCallback = callback
                    pendingGeoOrigin = origin
                    locationPermLauncher.launch(fineLocation)
                }
            }

            /** navigator.mediaDevices.getUserMedia() — 음성 메모 · 카메라 */
            override fun onPermissionRequest(request: PermissionRequest) {
                val needed = request.resources.mapNotNull { res ->
                    when (res) {
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                        else -> null
                    }
                }

                if (needed.isEmpty()) { request.deny(); return }

                val allGranted = needed.all {
                    ContextCompat.checkSelfPermission(this@MainActivity, it) ==
                            PackageManager.PERMISSION_GRANTED
                }

                if (allGranted) {
                    request.grant(request.resources)
                } else {
                    pendingWebPermRequest = request
                    mediaPermLauncher.launch(needed.toTypedArray())
                }
            }

            /** <input type="file" accept="image/*"> 파일 선택 */
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                // 이전 콜백이 있으면 취소 처리
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                filePickerLauncher.launch("image/*")
                return true
            }
        }

        // ── WebView 설정 ───────────────────────────────────────
        binding.webview.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // IndexedDB
            databaseEnabled = true
            @Suppress("DEPRECATION")
            setGeolocationEnabled(true)
            allowContentAccess = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            // 혼합 콘텐츠 허용 (CDN 타일 로드)
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        // 개발 디버그 시 Chrome DevTools 사용 가능
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    /** 뒤로가기: WebView 히스토리 → 앱 종료 */
    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webview.canGoBack()) {
                        binding.webview.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        )
    }
}
