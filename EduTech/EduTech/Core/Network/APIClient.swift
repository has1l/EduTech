import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.timeoutIntervalForResource = 60
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)

        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = enc

        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = dec
    }

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let data = try await rawRequest(endpoint)
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func requestVoid(_ endpoint: Endpoint) async throws {
        _ = try await rawRequest(endpoint)
    }

    func rawRequest(_ endpoint: Endpoint, retryOn401: Bool = true) async throws -> Data {
        let url = try buildURL(endpoint)
        var req = URLRequest(url: url)
        req.httpMethod = endpoint.method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if endpoint.needsAuth, let token = await TokenManager.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if http.statusCode == 401, retryOn401, endpoint.needsAuth {
            do {
                try await TokenManager.shared.refresh()
                return try await rawRequest(endpoint, retryOn401: false)
            } catch {
                throw APIError.unauthorized
            }
        }

        guard (200..<300).contains(http.statusCode) else {
            let detail = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw APIError.server(status: http.statusCode, message: detail?.detail?.message)
        }

        return data
    }

    private func buildURL(_ endpoint: Endpoint) throws -> URL {
        let trimmed = endpoint.path.hasPrefix("/") ? String(endpoint.path.dropFirst()) : endpoint.path
        let base = Config.apiBaseURL.appendingPathComponent(trimmed)
        guard var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidResponse
        }
        if !endpoint.query.isEmpty { components.queryItems = endpoint.query }
        guard let url = components.url else { throw APIError.invalidResponse }
        return url
    }
}

struct EmptyResponse: Decodable {}

private struct AnyEncodable: Encodable {
    let wrapped: Encodable
    init(_ wrapped: Encodable) { self.wrapped = wrapped }
    func encode(to encoder: Encoder) throws { try wrapped.encode(to: encoder) }
}
