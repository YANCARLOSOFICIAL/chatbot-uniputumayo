from pydantic import BaseModel


class LLMMessage(BaseModel):
    role: str
    content: str


class GenerateRequest(BaseModel):
    messages: list[LLMMessage]
    provider: str | None = None
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class TokenUsage(BaseModel):
    prompt: int
    completion: int
    total: int


class GenerateResponse(BaseModel):
    content: str
    provider: str
    model: str
    tokens_used: TokenUsage | None
    response_time_ms: int


class EmbedRequest(BaseModel):
    texts: list[str]
    provider: str | None = None


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimensions: int
    response_time_ms: int


class ProviderInfo(BaseModel):
    name: str
    models: list[str]
    is_available: bool
    is_default: bool


class ProvidersResponse(BaseModel):
    providers: list[ProviderInfo]


class LLMConfigUpdate(BaseModel):
    default_provider: str | None = None
    default_model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
