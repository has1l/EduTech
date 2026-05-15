import Foundation

enum APIError: Error, LocalizedError {
    case invalidResponse
    case unauthorized
    case server(status: Int, message: String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Неверный ответ сервера"
        case .unauthorized: return "Требуется вход"
        case .server(_, let msg): return msg ?? "Ошибка сервера"
        case .decoding: return "Ошибка обработки данных"
        case .transport(let e): return e.localizedDescription
        }
    }
}

struct APIErrorBody: Decodable {
    let detail: APIDetail?
}

enum APIDetail: Decodable {
    case string(String)
    case items([APIDetailItem])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let arr = try? c.decode([APIDetailItem].self) { self = .items(arr); return }
        self = .string("Unknown error")
    }

    var message: String {
        switch self {
        case .string(let s): return s
        case .items(let arr): return arr.first?.msg ?? "Validation error"
        }
    }
}

struct APIDetailItem: Decodable {
    let msg: String
}
