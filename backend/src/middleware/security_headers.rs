use axum::http::{HeaderName, HeaderValue};
use tower_http::set_header::SetResponseHeaderLayer;

pub fn layer() -> tower::layer::util::Stack<
    SetResponseHeaderLayer<HeaderValue>,
    tower::layer::util::Stack<
        SetResponseHeaderLayer<HeaderValue>,
        tower::layer::util::Stack<
            SetResponseHeaderLayer<HeaderValue>,
            tower::layer::util::Stack<
                SetResponseHeaderLayer<HeaderValue>,
                tower::layer::util::Stack<
                    SetResponseHeaderLayer<HeaderValue>,
                    tower::layer::util::Identity,
                >,
            >,
        >,
    >,
> {
    use tower::ServiceBuilder;
    ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .into_inner()
}
