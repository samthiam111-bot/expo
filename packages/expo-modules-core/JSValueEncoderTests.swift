import Testing

@testable import ExpoModulesCore

@Suite("JSValueEncoder")
@JavaScriptActor
struct JSValueEncoderTests {
  let runtime = JavaScriptRuntime()

  // MARK: - Primitive Types

  @Test
  func `encodes int`() throws {
    let value = 42
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isNumber() == true)
    #expect(try encoder.value.asInt() == 42)
  }

  @Test
  func `encodes double`() throws {
    let value = 3.14159
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isNumber() == true)
    #expect(try encoder.value.asDouble() == 3.14159)
  }

  @Test
  func `encodes bool true`() throws {
    let value = true
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isBool() == true)
    #expect(try encoder.value.asBool() == true)
  }

  @Test
  func `encodes bool false`() throws {
    let value = false
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isBool() == true)
    #expect(try encoder.value.asBool() == false)
  }

  @Test
  func `encodes string`() throws {
    let value = "Hello, World!"
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isString() == true)
    #expect(try encoder.value.asString() == "Hello, World!")
  }

  @Test
  func `encodes empty string`() throws {
    let value = ""
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isString() == true)
    #expect(try encoder.value.asString() == "")
  }

  // MARK: - Optional Types

  @Test
  func `encodes nil as null`() throws {
    let value: String? = nil
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isNull() == true)
  }

  @Test
  func `encodes optional string with value`() throws {
    let value: String? = "test"
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isString() == true)
    #expect(try encoder.value.asString() == "test")
  }

  @Test
  func `encodes optional int with value`() throws {
    let value: Int? = 123
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isNumber() == true)
    #expect(try encoder.value.asInt() == 123)
  }

  // MARK: - Arrays

  @Test
  func `encodes array of integers`() throws {
    let value = [1, 2, 3, 4, 5]
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let array = try encoder.value.asArray()
    #expect(array.count == 5)
    #expect(try array[0]?.asInt() == 1)
    #expect(try array[4]?.asInt() == 5)
  }

  @Test
  func `encodes array of strings`() throws {
    let value = ["foo", "bar", "baz"]
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let array = try encoder.value.asArray()
    #expect(array.count == 3)
    #expect(try array[0]?.asString() == "foo")
    #expect(try array[1]?.asString() == "bar")
    #expect(try array[2]?.asString() == "baz")
  }

  @Test
  func `encodes empty array`() throws {
    let value: [Int] = []
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isArray() == true)
    let array = try encoder.value.asArray()
    #expect(array.count == 0)
  }

  @Test
  func `encodes array with nil values`() throws {
    let value: [String?] = ["foo", nil, "bar"]
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let array = try encoder.value.asArray()
    #expect(array.count == 3)
    #expect(try array[0]?.asString() == "foo")
    #expect(array[1]?.isNull() == true)
    #expect(try array[2]?.asString() == "bar")
  }

  // MARK: - Structs (Keyed Containers)

  @Test
  func `encodes simple struct`() throws {
    struct Person: Encodable {
      let name: String
      let age: Int
    }

    let value = Person(name: "Alice", age: 30)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("name").asString() == "Alice")
    #expect(try object.getProperty("age").asInt() == 30)
  }

  @Test
  func `encodes struct with optional fields`() throws {
    struct User: Encodable {
      let id: Int
      let email: String?
      let nickname: String?
    }
    let value = User(id: 42, email: "test@example.com", nickname: nil)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)

    let object = try encoder.value.asObject()

    #expect(try object.getProperty("id").asInt() == 42)
    #expect(try object.getProperty("email").asString() == "test@example.com")
    #expect(object.getProperty("nickname").isUndefined() == true)
  }

  @Test
  func `encodes struct with nested struct`() throws {
    struct Address: Encodable {
      let street: String
      let city: String
    }

    struct Person: Encodable {
      let name: String
      let address: Address
    }

    let value = Person(
      name: "Bob",
      address: Address(street: "123 Main St", city: "Springfield")
    )
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("name").asString() == "Bob")

    let address = try object.getProperty("address").asObject()
    #expect(try address.getProperty("street").asString() == "123 Main St")
    #expect(try address.getProperty("city").asString() == "Springfield")
  }

  @Test
  func `encodes struct with array field`() throws {
    struct Team: Encodable {
      let name: String
      let members: [String]
    }

    let value = Team(name: "Engineering", members: ["Alice", "Bob", "Charlie"])
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("name").asString() == "Engineering")

    let members = try object.getProperty("members").asArray()
    #expect(members.count == 3)
    #expect(try members[0]?.asString() == "Alice")
    #expect(try members[1]?.asString() == "Bob")
    #expect(try members[2]?.asString() == "Charlie")
  }

  @Test
  func `encodes struct with mixed types`() throws {
    struct Config: Encodable {
      let enabled: Bool
      let timeout: Double
      let maxRetries: Int
      let url: String
    }

    let value = Config(enabled: true, timeout: 30.5, maxRetries: 3, url: "https://api.example.com")
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("enabled").asBool() == true)
    #expect(try object.getProperty("timeout").asDouble() == 30.5)
    #expect(try object.getProperty("maxRetries").asInt() == 3)
    #expect(try object.getProperty("url").asString() == "https://api.example.com")
  }

  // MARK: - Date Encoding

  @Test
  func `encodes date as ISO8601 string`() throws {
    let date = Date(timeIntervalSince1970: 1234567890)
    let encoder = JSValueEncoder(runtime: runtime)
    try date.encode(to: encoder)

    // JS value should be an instance of `Date`
    #expect(encoder.value.isObject() == true)

    let jsDate = try encoder.value.asObject()

    #expect(try jsDate.getProperty("constructor").asObject().getProperty("name").asString() == "Date")

    // Call `toISOString` on the `Date` object
    let isoString = try jsDate
      .getProperty("toISOString")
      .asFunction()
      .call(withArguments: [], thisObject: jsDate, asConstructor: false)
      .asString()

    #expect(isoString == "2009-02-13T23:31:30.000Z")
    #expect(date.formatted(JSValueEncodingContainer.iso8601formatStyle) == "2009-02-14T00:31:30.000+0100")
  }

  // MARK: - Array of Structs

  @Test
  func `encodes array of structs`() throws {
    struct Item: Encodable {
      let id: Int
      let name: String
    }

    let value = [
      Item(id: 1, name: "First"),
      Item(id: 2, name: "Second"),
      Item(id: 3, name: "Third")
    ]
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let array = try encoder.value.asArray()
    #expect(array.count == 3)

    let firstItem = try array[0]?.asObject()
    #expect(try firstItem?.getProperty("id").asInt() == 1)
    #expect(try firstItem?.getProperty("name").asString() == "First")

    let thirdItem = try array[2]?.asObject()
    #expect(try thirdItem?.getProperty("id").asInt() == 3)
    #expect(try thirdItem?.getProperty("name").asString() == "Third")
  }

  // MARK: - Complex Nested Structures

  @Test
  func `encodes complex nested structure`() throws {
    struct Tag: Encodable {
      let name: String
      let color: String
    }

    struct Comment: Encodable {
      let author: String
      let text: String
    }

    struct Post: Encodable {
      let title: String
      let content: String
      let tags: [Tag]
      let comments: [Comment]
      let isPublished: Bool
    }

    let value = Post(
      title: "My Post",
      content: "This is the content",
      tags: [
        Tag(name: "swift", color: "orange"),
        Tag(name: "ios", color: "blue")
      ],
      comments: [
        Comment(author: "Alice", text: "Great post!"),
        Comment(author: "Bob", text: "Thanks for sharing")
      ],
      isPublished: true
    )

    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("title").asString() == "My Post")
    #expect(try object.getProperty("content").asString() == "This is the content")
    #expect(try object.getProperty("isPublished").asBool() == true)

    let tags = try object.getProperty("tags").asArray()
    #expect(tags.count == 2)
    let firstTag = try tags[0]?.asObject()
    #expect(try firstTag?.getProperty("name").asString() == "swift")
    #expect(try firstTag?.getProperty("color").asString() == "orange")

    let comments = try object.getProperty("comments").asArray()
    #expect(comments.count == 2)
    let firstComment = try comments[0]?.asObject()
    #expect(try firstComment?.getProperty("author").asString() == "Alice")
    #expect(try firstComment?.getProperty("text").asString() == "Great post!")
  }

  // MARK: - Edge Cases

  @Test
  func `encodes struct with all optional fields set to undefined`() throws {
    struct OptionalFields: Encodable {
      let name: String?
      let age: Int?
      let email: String?
    }

    let value = OptionalFields(name: nil, age: nil, email: nil)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(object.getProperty("name").isUndefined() == true)
    #expect(object.getProperty("age").isUndefined() == true)
    #expect(object.getProperty("email").isUndefined() == true)
  }

  @Test
  func `encodes struct with empty string fields`() throws {
    struct EmptyStrings: Encodable {
      let first: String
      let second: String
    }

    let value = EmptyStrings(first: "", second: "")
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("first").asString() == "")
    #expect(try object.getProperty("second").asString() == "")
  }

  @Test
  func `encodes struct with zero values`() throws {
    struct ZeroValues: Encodable {
      let int: Int
      let double: Double
      let bool: Bool
    }

    let value = ZeroValues(int: 0, double: 0.0, bool: false)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("int").asInt() == 0)
    #expect(try object.getProperty("double").asDouble() == 0.0)
    #expect(try object.getProperty("bool").asBool() == false)
  }

  @Test
  func `encodes struct with special characters in strings`() throws {
    struct SpecialChars: Encodable {
      let text: String
    }

    let value = SpecialChars(text: "Hello \"World\" with 'quotes' and\nnewlines\t\ttabs")
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    let text = try object.getProperty("text").asString()
    #expect(text.contains("\"") == true)
    #expect(text.contains("'") == true)
    #expect(text.contains("\n") == true)
    #expect(text.contains("\t") == true)
  }

  @Test
  func `encodes struct with unicode characters`() throws {
    struct UnicodeTest: Encodable {
      let emoji: String
      let chinese: String
      let arabic: String
    }

    let value = UnicodeTest(emoji: "🚀🎉💻", chinese: "你好世界", arabic: "مرحبا")
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("emoji").asString() == "🚀🎉💻")
    #expect(try object.getProperty("chinese").asString() == "你好世界")
    #expect(try object.getProperty("arabic").asString() == "مرحبا")
  }

  @Test
  func `encodes negative numbers`() throws {
    struct NegativeNumbers: Encodable {
      let int: Int
      let double: Double
    }

    let value = NegativeNumbers(int: -42, double: -3.14159)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("int").asInt() == -42)
    #expect(try object.getProperty("double").asDouble() == -3.14159)
  }

  @Test
  func `encodes large numbers`() throws {
    struct LargeNumbers: Encodable {
      let int: Int
      let double: Double
    }

    let value = LargeNumbers(int: Int.max, double: Double.greatestFiniteMagnitude)
    let encoder = JSValueEncoder(runtime: runtime)
    try value.encode(to: encoder)

    #expect(encoder.value.isObject() == true)
    let object = try encoder.value.asObject()
    #expect(try object.getProperty("int").asInt() == Int.max)
    #expect(try object.getProperty("double").asDouble() == Double.greatestFiniteMagnitude)
  }
}
